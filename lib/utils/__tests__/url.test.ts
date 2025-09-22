import { addRefParameter } from '../url';

describe('addRefParameter', () => {
  test('adds ref parameter to URL without existing parameters', () => {
    const result = addRefParameter('https://example.com');
    expect(result).toBe('https://example.com/?ref=shadway');
  });

  test('adds ref parameter to URL with existing parameters', () => {
    const result = addRefParameter('https://example.com?foo=bar');
    expect(result).toBe('https://example.com/?foo=bar&ref=shadway');
  });

  test('handles custom ref value', () => {
    const result = addRefParameter('https://example.com', 'custom');
    expect(result).toBe('https://example.com/?ref=custom');
  });

  test('handles malformed URLs gracefully', () => {
    const result = addRefParameter('not-a-valid-url');
    expect(result).toBe('not-a-valid-url?ref=shadway');
  });

  test('handles URLs with hash fragments', () => {
    const result = addRefParameter('https://example.com#section');
    expect(result).toBe('https://example.com/?ref=shadway#section');
  });

  test('overwrites existing ref parameter', () => {
    const result = addRefParameter('https://example.com?ref=old');
    expect(result).toBe('https://example.com/?ref=shadway');
  });
});