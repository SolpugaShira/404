import { getStompClient } from '../stompClient';
import { request } from './http';

const normalizeParticipant = (participant) => ({
    userId: participant.userId,
    username: participant.username,
    hasBoost: participant.hasBoost ?? false,
    isBot: participant.isBot ?? participant.bot ?? false,
});

const normalizeRoomSummary = (room) => ({
    ...room,
    id: room.id ?? room.roomId,
    roomId: room.roomId ?? room.id,
    name: room.name ?? 'Комната',
    description: room.description ?? '',
    maxSeats: room.maxSeats ?? room.seatsCount ?? 0,
    entryFee: room.entryFee ?? 0,
    prizePoolPercent: room.prizePoolPercent ?? 0,
    boostEnabled: room.boostEnabled ?? false,
    boostCost: room.boostCost ?? 0,
    boostWeightMultiplier: room.boostWeightMultiplier ?? 0,
    participants: (room.participants ?? []).map(normalizeParticipant),
    currentParticipants: room.currentParticipants ?? room.participants?.length ?? 0,
    currentPrizePool: room.currentPrizePool ?? 0,
    status: room.status ?? 'WAITING',
});

const normalizeSessionUpdate = (session) => {
    if (!session) {
        return null;
    }

    const participants = (session.participants ?? []).map(normalizeParticipant);

    return {
        roomId: session.roomId ?? session.id,
        sessionId: session.sessionId ?? session.roomId ?? session.id,
        status: session.status ?? 'WAITING',
        participants,
        currentParticipants: session.currentParticipants ?? participants.length,
        currentPrizePool: session.currentPrizePool ?? 0,
        timerStartedAt: session.timerStartedAt ?? 60,
        secondsLeft: session.secondsLeft ?? 0,
        result: normalizeRoundResult(session.result),
    };
};

const mergeRoomState = (summary, sessionUpdate) => {
    if (!summary && !sessionUpdate) {
        return null;
    }

    const participants = sessionUpdate?.participants ?? summary?.participants ?? [];

    return {
        ...summary,
        ...sessionUpdate,
        id: summary?.id ?? summary?.roomId ?? sessionUpdate?.roomId,
        roomId: summary?.roomId ?? summary?.id ?? sessionUpdate?.roomId,
        name: summary?.name ?? 'Комната',
        description: summary?.description ?? '',
        maxSeats: summary?.maxSeats ?? 0,
        entryFee: summary?.entryFee ?? 0,
        prizePoolPercent: summary?.prizePoolPercent ?? 0,
        boostEnabled: summary?.boostEnabled ?? false,
        boostCost: summary?.boostCost ?? 0,
        boostWeightMultiplier: summary?.boostWeightMultiplier ?? 0,
        status: sessionUpdate?.status ?? summary?.status ?? 'WAITING',
        participants,
        currentParticipants: sessionUpdate?.currentParticipants ?? participants.length ?? summary?.currentParticipants ?? 0,
        currentPrizePool: sessionUpdate?.currentPrizePool ?? summary?.currentPrizePool ?? 0,
        timerStartedAt: sessionUpdate?.timerStartedAt ?? summary?.timerStartedAt ?? null,
        secondsLeft: sessionUpdate?.secondsLeft ?? summary?.secondsLeft ?? 0,
        sessionId: sessionUpdate?.sessionId ?? summary?.sessionId ?? null,
    };
};

const normalizeRoundResult = (result) => (
    result
        ? {
            ...result,
            userId: result.winnerId,
            username: result.winnerUsername,
            isBot: result.winnerIsBot,
            participants: (result.participants ?? []).map(normalizeParticipant),
        }
        : null
);

const publishRoomCommand = (destination, body = {}) => {
    const client = getStompClient();

    if (!client?.connected) {
        throw new Error('WebSocket is not connected');
    }

    console.log(`[WS][PUBLISH] ${destination}`, body);
    client.publish({
        destination,
        body: JSON.stringify(body),
    });
};

export const fetchRooms = async () => {
    const rooms = await request('/api/v1/rooms', {
        method: 'GET',
    });
    return rooms.map(normalizeRoomSummary);
};

export const fetchRoomSummaryById = async (roomId) => {
    try {
        const room = await request(`/api/v1/rooms/${roomId}`, {
            method: 'GET',
        });

        return room ? normalizeRoomSummary(room) : null;
    } catch (error) {
        console.error(`Failed to fetch room ${roomId}:`, error);
        return null;
    }
};

export const fetchRoomById = async (roomId) => {
    const [summary, session] = await Promise.all([
        fetchRoomSummaryById(roomId),
        request(`/api/v1/rooms/${roomId}/session`, {
            method: 'GET',
        }).catch(() => null),
    ]);

    return mergeRoomState(summary, normalizeSessionUpdate(session));
};

export const fetchWinnerByRoomId = async (roomId) => {
    const winner = await request(`/api/v1/rooms/${roomId}/winner`, {
        method: 'GET',
    });
    return normalizeRoundResult(winner);
};

export const joinRoom = async (roomId, userId, username) => {
    publishRoomCommand(`/app/room/${roomId}/join`, { userId, username });
};

export const leaveRoom = async (roomId, userId) => {
    const result = await request(`/api/v1/rooms/${roomId}/leave`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
    });

    return {
        ...result,
        room: normalizeSessionUpdate(result.room),
    };
};

export const activateBoost = async (roomId, userId) => {
    publishRoomCommand(`/app/room/${roomId}/boost`, { userId });
};

export const normalizeRoomsMessage = (rooms) => rooms.map(normalizeRoomSummary);
export const normalizeSessionMessage = (session, summary = null) => (
    mergeRoomState(summary, normalizeSessionUpdate(session))
);
export const normalizeRoundMessage = normalizeRoundResult;
