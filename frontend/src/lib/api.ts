export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const message = response.status === 401 ? "Your session expired. Please sign in again." : "Unable to save changes. Please try again.";
    throw new ApiError(response.status, message);
  }
  return response.json() as Promise<T>;
}
