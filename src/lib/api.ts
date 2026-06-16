// API Wrapper for simple interaction with backend endpoints

async function handleResponse(res: Response) {
    if (!res.ok) {
        const txt = await res.text();
        try {
            const parsed = JSON.parse(txt);
            if (parsed && parsed.error) {
                throw new Error(parsed.error);
            }
        } catch (jsErr) {
            // Ignore parsing errors and throw original text
        }
        throw new Error(txt);
    }
    return res.json();
}

export const api = {
    async get(endpoint: string, userId: string) {
        const res = await fetch(`/api${endpoint}`, {
            headers: { 'x-user-id': userId }
        });
        return handleResponse(res);
    },
    async post(endpoint: string, data: any, userId?: string) {
        const headers: any = { 'Content-Type': 'application/json' };
        if (userId) headers['x-user-id'] = userId;
        const res = await fetch(`/api${endpoint}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(data)
        });
        return handleResponse(res);
    }
}
