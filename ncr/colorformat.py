# COMMON DEFINITIONS ----------------------------------------------------------
PREFIX = "\x1b["
END = "m"
RESET = "\x1b[0m"

# ATTRIBUTE DEFINITIONS -------------------------------------------------------
NONE = "0"
BOLD = "1"
DIM = "2"
ITALIC = "3"
UNDER = UNDERSCORE = "4"
BLINK = "5"
REV = REVERSE = "7"  # Flip background and foreground
HIDDEN = "8"

# Resets all begin with a 2
# So reset italic -> 23
# and reset blink -> 25
RESET_ATTR_FLAG = "2"

# TEXT COLOR DEFINITIONS ------------------------------------------------------
BLACK = "30"
RED = "31"
GREEN = "32"
YELLOW = "33"
BLUE = "34"
MAGENTA = "35"
CYAN = "36"
GRAY = "37"
DEFAULT = "39"

TC_256 = "38;5"

# LIGHT TEXT COLOR DEFINITIONS ------------------------------------------------
LT_BLACK = "90"
LT_RED = "91"
LT_GREEN = "92"
LT_YELLOW = "93"
LT_BLUE = "94"
LT_MAGENTA = "95"
LT_CYAN = "96"
WHITE = "97"

# BACKGROUND COLOR DEFINITIONS ------------------------------------------------
BG_BLACK = "40"
BG_RED = "41"
BG_GREEN = "42"
BG_YELLOW = "43"
BG_BLUE = "44"
BG_MAGENTA = "45"
BG_CYAN = "46"
BG_GRAY = "47"
BG_DEFAULT = "49"

BG_256 = "48;5"

# LIGHT BACKGROUND COLOR DEFINITIONS ------------------------------------------
DK_BG_GRAY = "100"
BG_LT_RED = "101"
BG_LT_GREEN = "102"
BG_LT_YELLOW = "103"
BG_LT_BLUE = "104"
BG_LT_MAGENTA = "105"
BG_LT_CYAN = "106"
BG_WHITE = "107"

# FUN STRUCTURES --------------------------------------------------------------
RAINBOW = [
    RED, LT_RED, YELLOW, LT_YELLOW, GREEN, LT_GREEN, CYAN, BLUE, MAGENTA
]

NO_COLOR = False
DEBUG = False


def setText(message, col=DEFAULT, attr=[NONE], bg=BG_DEFAULT, reset=True):
    if NO_COLOR:
        return message
    attr = ";".join(attr)
    text = PREFIX + attr + ";"
    text += col
    text += ";" + bg + END
    text += message
    if reset:
        text += RESET
    return text


def setText256(message, col=-1, bg=-1, reset=True):
    if NO_COLOR:
        return message
    # http://misc.flogisoft.com/bash/tip_colors_and_formatting
    # used as a reference for colors
    text = PREFIX
    if col >= 0 and col <= 256:
        text += TC_256 + ";" + str(col)
    if bg >= 0 and bg <= 256:
        text += BG_256 + ";" + str(bg)
    text += END
    text += message
    if reset:
        text += RESET
    return text


def setError(message):
    if NO_COLOR:
        return message
    return setText(message, col=RED, attr=[BOLD])


def setSuccess(message):
    if NO_COLOR:
        return message
    return setText(message, col=GREEN, attr=[BOLD])


def setWarning(message):
    if NO_COLOR:
        return message
    return setText(message, col=YELLOW, attr=[BOLD])


def setDebug(message, line='', file=''):
    if NO_COLOR:
        return message
    return setText('[DEBUG line {} in {}] {}'.format(
        line, file, message), col=CYAN, attr=[BOLD]
    )


def setRainbow(message, attr=[NONE], reset=True):
    if NO_COLOR:
        return message
    text = ""
    for i, letter in enumerate(message):
        text += setText(
            letter, col=RAINBOW[i % len(RAINBOW)], attr=[BOLD], reset=False
        )
    text += resetText()
    return text


def resetAttr(attr=[NONE]):
    message = ''
    for a in attr:
        message += PREFIX + RESET_ATTR_FLAG + a + END
    return message


def resetText():
    return RESET


if __name__ == "__main__":
    print(setText(
        "Its all okay", col=CYAN, attr=[BOLD], bg=BG_DEFAULT, reset=True
    ))

    text = ''
    message = "Hello world! Look at the rainbows"
    for i, letter in enumerate(message):
        text += setText(
            letter,
            col=RAINBOW[i % len(RAINBOW)],
            attr=[BOLD, ITALIC, UNDER, BLINK],
            reset=False
        )
        text += resetText()
    print(text)

    text = ''
    for i in range(257):
        text += setText256("{0:^5}".format(str(i)), bg=i, reset=False)
        text += resetText()
    print(text)

    print("\n\n")
    print(setError("ERROR: we done goofed"))
    print(setWarning("WARNING: we could goof"))
    print(setSuccess("SUCCESS: we didn't goof"))
