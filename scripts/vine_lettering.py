"""Original monoline botanical lettering for the three Flow title cards.

Each ideograph has a square construction grid, a structural stroke, a smaller
branch and lanceolate leaves. Paths are original, in hundredths of an em.
The build unites them into normal selectable, scalable TrueType outlines.
"""
from math import hypot
import pathops
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.svgLib.path import parse_path

# Main stems, tendrils, leaf bases/tips/half-widths, horizontal advance.
LETTERS = {
    "记": (
        "M8 43H21Q25 43 25 47V77Q25 84 30 79L38 72 "
        "M45 27C58 27 67 25 77 25Q85 25 85 33V45Q85 51 79 51H51 "
        "M50 48V69Q50 84 64 84H78Q92 84 92 72",
        "M25 30Q23 21 17 15 M45 27C36 27 31 23 33 17C34 12 41 12 42 17 "
        "M92 73C92 66 96 60 103 61C110 62 110 71 104 71Q101 71 102 68",
        [(24,28,12,13,3.9),(34,24,26,21,2.1),(95,64,94,54,2.5)], 103),
    "忆": (
        "M28 24V84 M12 54Q17 48 18 39 M33 38Q39 40 43 47 "
        "M51 30H78Q87 30 81 37L57 65C47 77 52 85 65 85H77Q91 85 91 73",
        "M28 24C28 18 23 14 21 11C17 5 24 0 28 5Q30 8 27 10 "
        "M28 83C28 93 34 98 42 98C49 98 54 92 50 87Q47 84 44 88 "
        "M91 73Q91 63 98 58",
        [(24,16,15,14,2.5),(36,97,33,104,2.0),(94,63,102,56,2.95)], 100),
    "之": (
        "M23 42H68Q78 42 72 48L30 73 "
        "M12 80C24 67 36 68 53 75C67 82 80 87 92 78",
        "M53 32C53 24 61 21 62 14Q62 10 59 8 M92 78C99 74 105 71 104 64"
        "C103 57 96 56 93 61Q91 65 95 67",
        [(53,30,43,13,4.15),(59,20,69,14,2.65),(99,73,110,75,2.3)], 99),
    "场": (
        "M25 24V71 M9 44H40 M7 78Q24 75 39 68 "
        "M49 27H76Q84 27 79 32L53 52Q73 45 83 50Q94 54 89 67L83 82Q81 89 75 85L69 81 "
        "M64 54Q59 69 45 77 M77 54Q72 75 57 87",
        "M25 25C25 16 27 11 34 10C40 9 43 14 40 18Q38 20 36 18 "
        "M79 86C83 96 95 100 106 93C115 87 117 77 111 72C106 68 99 71 100 77Q101 81 105 80",
        [(26,18,19,8,2.9),(31,11,32,3,2.0),(91,96,99,103,2.3),(110,89,120,86,2.65)], 117),
    "花": (
        "M12 30Q31 27 50 29Q72 31 89 27 M35 17V39 M67 17Q67 28 63 39 "
        "M41 45Q29 61 13 69 M31 56V86 "
        "M57 46V70Q57 84 69 84H77Q90 84 90 72 M83 48Q73 59 57 65",
        "M35 19Q34 11 27 10 M66 21C70 15 72 8 80 7C86 6 90 10 88 14Q87 17 84 16 "
        "M89 28Q95 27 99 23 M90 74Q91 65 99 61",
        [(31,12,23,5,2.65),(72,12,71,3,2.3),(96,25,103,18,2.7),(94,66,104,62,2.5)], 101),
    "园": (
        "M18 77V38Q18 28 27 25C41 20 63 20 76 24Q86 27 86 38V75Q86 85 76 85H27Q18 85 18 77Z "
        "M34 40H69 M31 52H72 M46 52Q44 65 33 72 M58 52V64Q58 72 66 72Q73 72 73 66",
        "M73 23C80 21 81 12 89 11C95 10 100 14 98 19Q96 22 93 20 "
        "M80 84C84 95 95 100 106 94C115 89 118 78 112 73C107 69 100 72 101 78Q102 82 106 80",
        [(81,17,80,7,2.6),(88,11,95,4,2.2),(93,97,101,104,2.25),(111,91,121,88,2.65)], 117),
    "城": (
        "M23 25V69 M8 42H36 M7 77Q24 73 35 66 M65 18Q68 63 87 84Q92 90 94 79 "
        "M83 22L89 27 M91 36Q66 38 48 39V56Q48 73 38 84 "
        "M48 52H62Q66 53 64 61L61 73Q59 78 54 74 M85 47Q79 69 66 82",
        "M23 25Q22 17 16 13 M65 19C63 11 58 8 53 10Q47 13 51 17",
        [(18,16,10,10,2.8),(58,11,56,4,2.1)], 100),
    "市": (
        "M12 34Q46 31 89 33 M50 33V88 M24 77V54Q24 48 29 48H72Q78 48 78 54V70Q78 77 71 75L66 73",
        "M49 24Q48 17 43 13 M89 33C98 32 101 27 98 22Q95 18 91 21 "
        "M50 86C50 94 57 98 63 95Q69 92 66 88",
        [(48,22,38,9,3.55),(95,30,104,29,2.1)], 100),
    "谱": (
        "M8 45H19Q23 45 23 49V78Q23 84 28 79L34 74 "
        "M47 21L53 29 M78 19L71 29 M39 32H91 M58 32V52 M71 32V52 "
        "M42 40L49 47 M86 39L78 47 M37 54H93 "
        "M47 65Q47 61 52 61H78Q83 61 83 66V81Q83 86 78 86H52Q47 86 47 81Z M48 73H82",
        "M22 32Q19 23 13 19 M90 54C98 52 102 45 98 41Q95 38 92 41 "
        "M81 85Q87 94 97 89",
        [(21,30,10,17,3.6),(95,50,104,51,2.05),(91,91,99,84,2.15)], 104),
}


def stroked(data, width):
    path = pathops.Path()
    parse_path(data, path.getPen())
    path.stroke(width, pathops.LineCap.ROUND_CAP, pathops.LineJoin.ROUND_JOIN, 3)
    path.convertConicsToQuads(.045)
    return path


def blade(x, y, tx, ty, width):
    dx, dy = tx-x, ty-y
    scale = width / hypot(dx,dy)
    def at(t,n):
        return x+t*dx-n*dy*scale, y+t*dy+n*dx*scale
    path = pathops.Path()
    pen = path.getPen()
    pen.moveTo((x,y))
    pen.curveTo(at(.24,-1.2),at(.68,-1.00),(tx,ty))
    pen.curveTo(at(.80,.78),at(.30,1.22),(x,y))
    pen.closePath()
    return path


def build_wordmarks(filename):
    glyphs = {".notdef":TTGlyphPen(None).glyph(), "space":TTGlyphPen(None).glyph()}
    metrics = {".notdef":(500,0), "space":(340,0)}
    cmap = {32:"space"}
    for char,(structure,branches,leaves,advance) in LETTERS.items():
        name = f"uni{ord(char):04X}"
        path = stroked(structure,3.65)
        path = pathops.op(path,stroked(branches,1.47),pathops.PathOp.UNION)
        for leaf in leaves:
            path = pathops.op(path,blade(*leaf),pathops.PathOp.UNION)
        outline = TTGlyphPen(None)
        pen = TransformPen(Cu2QuPen(outline,.7), (10,0,0,-10,0,875))
        path.draw(pen)
        glyphs[name] = outline.glyph()
        glyphs[name].recalcBounds(None)
        metrics[name] = (advance*10,glyphs[name].xMin)
        cmap[ord(char)] = name
    font = FontBuilder(1000,isTTF=True)
    font.setupGlyphOrder(list(glyphs))
    font.setupCharacterMap(cmap)
    font.setupGlyf(glyphs)
    font.setupHorizontalMetrics(metrics)
    font.setupHorizontalHeader(ascent=930,descent=-205)
    font.setupNameTable({"familyName":"Flow Vine","styleName":"Regular","psName":"FlowVine-Regular",
                         "fullName":"Flow Vine Regular","version":"Version 1.000"})
    font.setupOS2(sTypoAscender=930,sTypoDescender=-205,usWinAscent=930,usWinDescent=205)
    font.setupPost()
    # The original drawings are dated 2026-11-23 (OpenType epoch).
    font.font["head"].created = font.font["head"].modified = 3878236800
    font.font.recalcTimestamp = False
    font.font.flavor = "woff2"
    font.save(filename)
