import { getStompClient } from '../stompClient';
import { request } from './http';

const normalizeParticipant = (participant) => ({
    userId: participant.userId,
    username: participant.username,
    seats: participant.seats ?? 1,
    boosts: participant.boosts ?? 0,
    isBot: participant.isBot ?? participant.bot ?? false,
});

export const normalizeRoomSummary = (room) => {
    const participants = (room.participants ?? []).map(normalizeParticipant);
    const currentParticipants = participants.reduce((sum, p) => sum + p.seats, 0);

    return {
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
        participants,
        currentParticipants,
        currentPrizePool: room.currentPrizePool ?? 0,
        status: room.status ?? 'WAITING',
    };
};

const normalizeSessionUpdate = (session) => {
    if (!session) {
        return null;
    }

    const participants = (session.participants ?? []).map(normalizeParticipant);
    const currentParticipants = participants.reduce((sum, p) => sum + p.seats, 0);

    return {
        roomId: session.roomId ?? session.id,
        sessionId: session.sessionId ?? session.roomId ?? session.id,
        status: session.status ?? 'WAITING',
        participants,
        currentParticipants,
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
        currentParticipants: sessionUpdate?.currentParticipants ?? summary?.currentParticipants ?? participants.reduce((sum, p) => sum + p.seats, 0),
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

export const bookSeats = async (roomId, userId, seats) => {
    publishRoomCommand(`/app/room/${roomId}/book-seats`, { userId, seats });
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

export const activateBoost = async (roomId, userId, boosts) => {
    publishRoomCommand(`/app/room/${roomId}/boost`, { userId, boosts });
};

export const normalizeRoomsMessage = (rooms) => rooms.map(normalizeRoomSummary);
export const normalizeSessionMessage = (session, summary = null) => (
    mergeRoomState(summary, normalizeSessionUpdate(session))
);
export const normalizeRoundMessage = normalizeRoundResult;
