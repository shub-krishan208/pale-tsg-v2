"""
Shared test data fixtures for token/data generation commands.

Edit this file to add/control variations for test data generation.
Used by:
  - generate_test_token
  - generate_test_data
  - simulate_day
"""

import random


# ============================================================================
# TIME BIAS UTILITIES
# ============================================================================
def biased_hour(hour_start: int, hour_end: int, bias: str = "none") -> int:
    """
    Generate a biased random hour within range using triangular distribution.
    
    Args:
        hour_start: Start of working hours (inclusive)
        hour_end: End of working hours (exclusive)
        bias: "entry" (favors early), "exit" (favors late), or "none" (uniform)
    
    Returns:
        Random hour biased according to the mode
    """
    if hour_end <= hour_start:
        hour_end = 24
    
    if bias == "entry":
        # Bias towards first 30% of the range (morning rush)
        mode = hour_start + (hour_end - hour_start) * 0.3
    elif bias == "exit":
        # Bias towards 75% of the range (evening rush, before midnight)
        mode = hour_start + (hour_end - hour_start) * 0.75
    else:
        # Uniform distribution
        mode = (hour_start + hour_end) / 2
    
    return int(random.triangular(hour_start, hour_end - 1, mode))

# ============================================================================
# LAPTOP OPTIONS
# Empty strings = no laptop (weight accordingly)
# ============================================================================
LAPTOP_OPTIONS = [
    "Dell XPS 13",
    "Dell XPS 15",
    "MacBook Air M2",
    "MacBook Pro M4",
    "ThinkPad X1 Carbon",
    "ThinkPad T14",
    "HP Spectre x360",
    "HP Victus",
    "HP Pavilion 14",
    "ASUS ZenBook 14",
    "ASUS ROG Strix",
    "Lenovo IdeaPad Slim 5",
    "Acer Swift 3",
    "Microsoft Surface Laptop 5",
    "MSI Modern 14",
    "Samsung Galaxy Book",
    "Framework Laptop 13",
    "",
    "",
    "",
]


# ============================================================================
# EXTRA ITEMS
# Each entry is a list of items the user might bring
# ============================================================================
EXTRA_ITEMS = [
    # --- mixed: book + gadget (5) ---
    [{"name": "Keys", "type": "gadgets"}, {"name": "Atomic Habits", "type": "books"}],
    [{"name": "Laptop Charger", "type": "gadgets"}, {"name": "Deep Work", "type": "books"}],
    [{"name": "Phone", "type": "gadgets"}, {"name": "Clean Code", "type": "books"}],
    [{"name": "Tablet", "type": "gadgets"}, {"name": "Design of Everyday Things", "type": "books"}],
    [{"name": "Notebook", "type": "stationery"}, {"name": "Algorithms Unlocked", "type": "books"}],

    # --- book only (9) ---
    [{"name": "Atomic Habits", "type": "books"}],
    [{"name": "Deep Work", "type": "books"}],
    [{"name": "Clean Architecture", "type": "books"}],
    [{"name": "Introduction to Algorithms", "type": "books"}],
    [{"name": "Linear Algebra Done Right", "type": "books"}],
    [{"name": "Operating Systems Concepts", "type": "books"}],
    [{"name": "The Pragmatic Programmer", "type": "books"}],
    [{"name": "Computer Networks", "type": "books"}],
    [{"name": "Discrete Mathematics", "type": "books"}],

    # --- gadget only (12 normal + 1 heavy) ---
    [{"name": "Keys", "type": "gadgets"}],
    [{"name": "Phone", "type": "gadgets"}],
    [{"name": "Water Bottle", "type": "gadgets"}],
    [{"name": "Earphones", "type": "gadgets"}],
    [{"name": "Laptop", "type": "gadgets"}],
    [{"name": "Laptop Charger", "type": "gadgets"}],
    [{"name": "Power Bank", "type": "gadgets"}],
    [{"name": "Mouse", "type": "gadgets"}],
    [{"name": "Calculator", "type": "gadgets"}],
    [{"name": "Tablet", "type": "gadgets"}],
    [{"name": "Smart Watch", "type": "gadgets"}],
    [{"name": "USB Drive", "type": "gadgets"}],

    # --- heavy gadget case (rare, maxed out) ---
    [
        {"name": "Keys", "type": "gadgets"},
        {"name": "Laptop Charger", "type": "gadgets"},
        {"name": "Mouse", "type": "gadgets"},
        {"name": "Keyboard", "type": "gadgets"},
        {"name": "Headphones", "type": "gadgets"},
        {"name": "Power Bank", "type": "gadgets"},
        {"name": "USB Hub", "type": "gadgets"},
        {"name": "External SSD", "type": "gadgets"},
        {"name": "Calculator", "type": "gadgets"},
        {"name": "Phone", "type": "gadgets"},
    ],

    # --- empty (3) ---
    [],
    [],
    [],
]


# ============================================================================
# DEVICE METADATA TEMPLATES
# os/source combinations for realistic device variety
# ============================================================================
DEVICE_META_TEMPLATES = [
    {"os": "android", "source": "APP"},
    {"os": "android", "source": "APP"},
    {"os": "android", "source": "APP"},
    {"os": "ios", "source": "APP"},
    {"os": "ios", "source": "APP"},
    {"os": "ios", "source": "APP"},
    {"os": "linux", "source": "WEB"},
    {"os": "windows", "source": "WEB"},
    {"os": "macos", "source": "WEB"},
    {"source": "GATE"},  # For forced entries
]

