/**
 * Auto-capitalize first letter of each word when typing.
 * Only applies when new value is longer (typing), not when shorter (backspace).
 */
export function autoCapitalize(newValue: string, oldValue: string): string {
    // Allow undo via backspace - don't transform if deleting
    if (newValue.length <= oldValue.length) {
        return newValue;
    }
    // Capitalize first letter of each word
    return newValue.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function initials(name?: string) {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "U";
}

/**
 * Sanitize user input to prevent injection attacks.
 * Strips HTML tags, script content, and dangerous characters.
 * Only allows alphanumeric, spaces, and common safe punctuation.
 */
export function sanitizeInput(input: string): string {
    return input
        // Remove HTML tags
        .replace(/<[^>]*>/g, '')
        // Remove script-like patterns
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '')
        // Only allow safe characters: letters, numbers, spaces, and common punctuation
        .replace(/[^\w\s\-.,()'/]/g, '');
}

/**
 * Combined sanitize and auto-capitalize for text inputs
 */
export function safeAutoCapitalize(newValue: string, oldValue: string): string {
    const sanitized = sanitizeInput(newValue);
    return autoCapitalize(sanitized, oldValue);
}
