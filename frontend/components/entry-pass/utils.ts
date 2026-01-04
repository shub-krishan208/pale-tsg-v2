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
