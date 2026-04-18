const DEFAULT_HTTP_BASE_URL = import.meta.env.DEV ? '' : 'https://sigma-ways.org';

export const HTTP_BASE_URL = (
    import.meta.env.VITE_API_BASE_URL ?? DEFAULT_HTTP_BASE_URL
).replace(/\/+$/, '');

export const HTTP_BASE_URL_LABEL = HTTP_BASE_URL || '/api';

const buildUrl = (path) => {
    if (!path) {
        return HTTP_BASE_URL;
    }

    if (/^https?:\/\//i.test(path)) {
        return path;
    }

    return `${HTTP_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

const parseResponse = async (response) => {
    if (response.status === 204) {
        return null;
    }

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
        return response.json();
    }

    return response.text();
};

export const request = async (path, options = {}) => {
    const response = await fetch(buildUrl(path), {
        redirect: 'follow',
        ...options,
    });

    const payload = await parseResponse(response);

    if (!response.ok) {
        const message = typeof payload === 'string' && payload
            ? payload
            : `Request failed with status ${response.status}`;
        throw new Error(message);
    }

    return payload;
};

export const fetchServerRoot = async () => request('/api/v1/rooms', {
    method: 'GET',
});
