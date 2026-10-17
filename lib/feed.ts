/**
 * How many components a page of the feed carries.
 *
 * Shared by the server render and the client's refresh so both ask for exactly
 * the same set: the grid can then paint from the first response instead of
 * repainting itself the moment the client's own request lands.
 */
export const FEED_LIMIT = 48;
