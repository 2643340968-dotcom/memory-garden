"""Draw the atlas specimens, then bake stable x/y/ink slots for FieldStudy.

Run from any directory with Python, Pillow and NumPy. Coordinates below are
engraving coordinates on a 380 by 220 plate. Higher values deposit more ink.
"""
import base64
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageOps


ATLAS = Path(__file__).resolve().parents[1] / "src" / "atlas"
WIDTH, HEIGHT, COUNT = 380, 220, 3500
TAU = math.tau


def bezier(a, b, c, d, steps=34):
    return [tuple((1-t)**3*a[k] + 3*(1-t)**2*t*b[k] + 3*(1-t)*t*t*c[k] + t**3*d[k]
                  for k in (0, 1)) for t in np.linspace(0, 1, steps)]


class Engraving:
    def __init__(self):
        self.image = Image.new("L", (WIDTH, HEIGHT))
        self.pen = ImageDraw.Draw(self.image)

    def line(self, points, ink=200, width=1):
        self.pen.line(points, fill=ink, width=width, joint="curve")

    def stem(self, a, b, c, d, width=2):
        self.line(bezier(a, b, c, d), 213, width)

    def dot(self, x, y, r=1, ink=215):
        self.pen.ellipse((x-r, y-r, x+r, y+r), fill=ink)

    def blade(self, a, b, width, bend=0, serration=0, veins=True):
        dx, dy = b[0]-a[0], b[1]-a[1]
        length = math.hypot(dx, dy)
        nx, ny = -dy/length, dx/length

        def edge(t, side):
            bow = math.sin(math.pi*t)
            radius = width * bow**.87 * (1 + serration * math.sin(t*83))
            cross = bend * bow + side * radius
            return (a[0]+dx*t+nx*cross, a[1]+dy*t+ny*cross)

        ts = np.linspace(0, 1, 60)
        outline = [edge(t, 1) for t in ts] + [edge(t, -1) for t in reversed(ts)]
        self.pen.polygon(outline, fill=42)
        self.line(outline, 196)
        self.line([edge(t, 0) for t in ts], 219)
        if veins and width >= 5:
            for t in (.18, .32, .47, .61, .74):
                for side in (-.83, .83):
                    self.line([edge(t, 0), edge(t+.13, side)], 125)

    def petal(self, x, y, angle, length, width, curl=0, ruffle=0):
        # A rounded petal with a narrow claw. The central crease and two
        # outer veins survive the reduction to a small, stippled impression.
        alpha = math.radians(angle)
        sn, cs = math.sin(alpha), math.cos(alpha)

        def pos(u, v):
            cross = width*u + curl*v*v
            return (x + cross*cs + length*v*sn, y + cross*sn - length*v*cs)

        outline = []
        for theta in np.linspace(0, TAU, 94):
            v = (1 - math.cos(theta)) * .5
            u = math.sin(theta) * (.37 + .88*v)
            v += ruffle * .037 * math.cos(7*theta+.45) * v*v
            outline.append(pos(u, v))
        self.pen.polygon(outline, fill=61)
        self.line(outline, 237)
        for offset in (-.44, 0, .42):
            self.line([pos(offset*math.sin(t*2.0), t) for t in np.linspace(.09,.86,20)], 123)

    def pollen(self, x, y, radius, count=17):
        for i in range(count):
            angle = 2.4*i
            r = radius*math.sqrt((i+.4)/count)
            self.dot(x+math.cos(angle)*r, y+math.sin(angle)*r*.72, .9, 247)

    def small_flower(self, x, y, radius, petals=5, tilt=0):
        for i in range(petals):
            self.petal(x, y, tilt + 360*i/petals, radius*(1+.07*math.sin(i*2)), radius*.46)
        self.pollen(x, y, radius*.25, 6)


def fan(g, x, y, tip, scale=1):
    for dx, dy, w, bend in tip:
        g.blade((x,y), (x+dx*scale,y+dy*scale), w*scale, bend*scale, veins=False)


def woody(g, thick=3):
    g.stem((145,209),(159,186),(198,136),(222,56),thick)
    g.stem((173,168),(161,148),(146,137),(140,101))
    g.stem((197,126),(210,115),(239,116),(255,91))


def broad_leaves(g):
    g.blade((173,167),(123,133),11,-8,.06)
    g.blade((183,154),(237,128),13,8,.06)
    g.blade((197,121),(174,101),7,-3)


def tree_bloom(g, kind):
    woody(g)
    if kind == "magnolia":
        for x,y,s in [(140,104,.49),(254,92,.33),(219,75,1)]:
            for angle,l,w,c in [(-29,52,12,-4),(12,61,13,5),(44,47,12,5),(-6,47,14,-5),(-54,34,9,2)]:
                g.petal(x,y,angle,l*s,w*s,c*s)
        g.blade((180,158),(209,135),5,2)
    elif kind in ("plum","cherry"):
        # Plum flowers sit against old wood; cherries hang on fine pedicels.
        if kind == "plum":
            g.stem((218,75),(213,53),(227,43),(233,25))
            for x,y,r in [(142,109,12),(152,137,8),(173,167,6),(202,110,14),(217,77,16),(228,50,8),(247,102,6)]:
                g.small_flower(x,y,r,5,x%29)
            for x,y in [(234,26),(140,99),(255,88),(207,87)]:
                g.dot(x,y,3)
        else:
            for x,y,s in [(140,104,.65),(211,91,1),(247,101,.76),(218,64,.71)]:
                for dx,dy,r in [(-10,13,12),(7,21,13),(17,5,9)]:
                    g.stem((x,y),(x+dx*.3,y+4),(x+dx*s,y+dy*s-5),(x+dx*s,y+dy*s),1)
                    g.small_flower(x+dx*s,y+dy*s,r*s,5,dx)
            g.blade((195,131),(168,108),7,-3,.10)
    elif kind == "coral":
        for x,y in [(188,146),(151,137)]:
            for dx,dy in [(-31,-18),(3,-36),(29,-24)]:
                g.blade((x,y),(x+dx,y+dy),9,3)
        for x,y,s in [(223,58,1),(253,91,.6)]:
            g.stem((x-13,y+38),(x-5,y+16),(x+5,y-6),(x+7,y-38))
            for i in range(9):
                t=i/8
                side=(-1)**i
                xx=x-11+18*t
                yy=y+26-61*t
                g.petal(xx,yy,side*(59-25*t),31*(1-.43*t)*s,7*s,-side*9*s)
    elif kind == "osmanthus":
        for x,y,dx,dy in [(162,181,-43,-21),(173,165,44,1),(192,137,-41,-21),(214,87,40,-16),(220,66,16,-39),(150,133,-38,-25)]:
            g.blade((x,y),(x+dx,y+dy),9,3,.055)
        for x,y in [(143,109),(156,145),(206,110),(216,78),(246,101)]:
            for dx,dy in [(-8,-2),(2,-9),(9,1),(1,6),(-8,9)]:
                g.small_flower(x+dx,y+dy,4.8,4,dx*2)
    elif kind == "lilac":
        g.blade((172,166),(121,121),17,-3)
        g.blade((184,150),(235,118),14,4)
        for x,y,s in [(222,65,1),(146,112,.55)]:
            for row in range(8):
                n = 2 + row//2
                for j in range(n):
                    xx=x+(j-(n-1)/2)*8*s+math.sin(row*.9)*2
                    yy=y-40*s+row*8*s+math.cos(j*2)*2
                    g.small_flower(xx,yy,5.8*s,4,j*19+row*9)
    else:  # camellia
        broad_leaves(g)
        g.blade((238,109),(269,81),8,3,.08)
        for ring,(count,length,width) in enumerate([(9,37,17),(7,26,13),(5,15,9)]):
            for i in range(count):
                g.petal(218,60,360*i/count+ring*19,length,width,3)
        g.pollen(218,60,6)


def herb(g, kind):
    if kind == "lotus":
        g.stem((163,208),(172,163),(199,102),(203,74),3)
        g.stem((165,201),(155,176),(143,156),(135,142),2)
        lobes=[]
        for a in np.linspace(0,TAU,150):
            r=1+.04*math.cos(11*a)
            lobes.append((134+42*math.cos(a)*r,139+15*math.sin(a)*r-6*math.cos(a)))
        g.pen.polygon(lobes,fill=58)
        g.line(lobes,211)
        for x,y in lobes[::10]:
            g.stem((137,142),(132+(x-134)*.2,133),(x,140+(y-140)*.5),(x,y),1)
        # Lotus petals narrow to pointed tips. Layers fan out from the cup,
        # with low outer petals and a taller, partly closed central whorl.
        for dx,dy,w,bend in [(-35,-34,9,-4),(-11,-51,10,-3),(9,-56,11,4),
                              (31,-42,10,4),(-48,-16,8,-3),(45,-22,9,7),
                              (-28,-33,12,-6),(19,-37,12,6),(-3,-30,12,1)]:
            g.blade((204,80),(204+dx,80+dy),w,bend,veins=False)
        g.stem((178,179),(196,158),(221,141),(235,126),1)
        g.pen.ellipse((225,118,247,126),fill=169,outline=242)
        for i in range(5):
            g.dot(228+i*3.5,122+math.sin(i),.8,35)
    elif kind in ("iris","daylily","orchid"):
        blades = [(-47,-98,5,-8),(-34,-132,5,-5),(6,-120,6,4),(44,-90,5,10)]
        if kind != "iris":
            blades = [(-54,-58,5,-20),(-42,-99,4,-21),(44,-87,5,20),(70,-50,4,22)]
        fan(g,163,203,blades)
        g.stem((163,207),(170,159),(193,119),(209,75),2)
        if kind == "iris":
            for angle,l,w,c in [(-15,42,13,-8),(18,38,13,5),(0,42,10,0)]:
                g.petal(209,73,angle,l,w,c,1)
            for angle,l,w,c in [(-106,37,16,-7),(104,37,16,8),(172,31,14,5)]:
                g.petal(209,72,angle,l,w,c,1)
            for angle in [-112,107,166]:
                g.petal(210,73,angle,15,2)
            g.blade((190,131),(208,99),6,2)
        elif kind == "daylily":
            for i in range(6):
                angle=-77+i*52
                g.petal(211,73,angle,38 if i%2 else 34,9,9 if i%2 else -5)
            for i in range(6):
                a=i*.26+.2
                x,y=212+23*math.cos(a),74-21*math.sin(a)
                g.stem((211,74),(218,72),(x+3,y-1),(x,y),1)
                g.dot(x,y,1.6)
            g.stem((192,112),(207,104),(227,107),(237,91))
            g.petal(236,93,34,23,5)
        else:
            for angle,l,w,c in [(-66,31,4,-5),(0,32,5,2),(65,33,5,7),(-31,20,8,-4),(39,20,8,3),(159,15,9,6)]:
                g.petal(207,77,angle,l,w,c)
            g.pollen(208,78,4,9)
    elif kind == "peony":
        g.stem((154,207),(164,160),(200,122),(213,83),3)
        for x,y,dx,dy in [(173,166,-31,-32),(193,132,33,-12)]:
            g.stem((x,y),(x+dx*.4,y-5),(x+dx*.7,y+dy),(x+dx,y+dy))
            for j in [-1,0,1]:
                g.blade((x+dx,y+dy),(x+dx+j*16-5,y+dy-27+abs(j)*7),6,-3)
        for row,(n,rad,reach) in enumerate([(13,23,28),(10,15,22),(8,7,18),(7,1,12)]):
            for j in range(n):
                a=TAU*j/n+row*.67
                g.petal(210+rad*math.cos(a),64+rad*.72*math.sin(a),
                        math.degrees(a)+90,reach*(.88+.13*math.cos(j*7)),reach*.62,4*math.sin(j),2)
        g.pollen(211,63,5)
    elif kind == "chrysanthemum":
        g.stem((151,208),(178,162),(187,107),(208,65),3)
        for x,y,dx in [(170,174,-30),(184,137,35),(190,115,-22)]:
            for j in [-1,0,1]:
                g.blade((x+j*3,y-j*3),(x+dx+j*8,y-28+j*4),6,j*2,.14)
        for ring,(n,l) in enumerate([(29,39),(21,28),(17,17)]):
            for j in range(n):
                g.petal(210,65,360*j/n+ring*11,l*(.92+.11*math.cos(j*3)),3+ring*.65,4*math.sin(j+ring))
        g.pollen(210,65,6)
    elif kind == "hibiscus":
        g.stem((147,208),(161,168),(185,121),(208,74),3)
        for x,y,dx in [(170,167,-29),(180,146,30)]:
            for j in [-1,0,1]:
                g.blade((x,y),(x+dx+j*13,y-31+abs(j)*9),7,3,.11)
        for j in range(5):
            g.petal(211,72,-20+72*j,43,28,11,1)
        g.stem((210,72),(214,67),(222,58),(231,54),3)
        g.pollen(231,54,4,12)
    elif kind == "jasmine":
        woody(g,2)
        broad_leaves(g)
        for x,y,s in [(221,66,1),(244,91,.68),(144,110,.55)]:
            g.small_flower(x,y,24*s,7,14)
        g.petal(202,110,-36,21,5)
    elif kind == "honeysuckle":
        g.stem((134,209),(204,166),(161,136),(209,92),3)
        g.stem((207,95),(217,85),(202,79),(216,70))
        for x,y,ax,ay in [(173,161,-42,-27),(172,159,45,-13),(199,104,-29,-25),(204,99,27,-22)]:
            g.blade((x,y),(x+ax,y+ay),9,3)
        for x,y,angle in [(215,72,-46),(215,72,47),(185,125,-66),(185,125,-26)]:
            sn,cs=math.sin(math.radians(angle)),math.cos(math.radians(angle))
            ex,ey=x+26*sn,y-26*cs
            g.petal(x,y,angle,30,3)
            for d in [-34,-16,4,20]:
                g.petal(ex,ey,angle+d,17,3,d*.14)
            for d in [0,.13,.29]:
                tx,ty=ex+23*(sn+d),ey-22*cs
                g.line([(ex,ey),(tx,ty)],182)
                g.dot(tx,ty,1)
    elif kind == "tamarisk":
        g.stem((130,206),(164,190),(187,144),(219,109),3)
        for x,y,dx,dy in [(159,180,-18,-75),(176,158,-7,-88),(187,144,20,-100),(197,134,52,-90),(204,119,66,-54),(174,166,78,-31)]:
            path=bezier((x,y),(x+dx*.34,y+dy*.52),(x+dx*.81,y+dy*.79),(x+dx,y+dy),48)
            g.line(path,198)
            for i,(xx,yy) in enumerate(path[5:]):
                side=(-1)**i
                reach=1+4*math.sin(i*math.pi/43)
                g.line([(xx,yy),(xx+side*reach,yy-4)],174)
                g.dot(xx+side*reach,yy-4,1.05,242)


def zijincao():
    plant = Image.open(ATLAS/"zijincao.webp").convert("RGBA").rotate(-24, Image.Resampling.BICUBIC, expand=True)
    plant.thumbnail((WIDTH-26, HEIGHT-3), Image.Resampling.LANCZOS)
    plate = Image.new("L", (WIDTH, HEIGHT))
    ink = ImageOps.grayscale(plant).point(lambda n: min(255, 40+n*1.03))
    plate.paste(ink, ((WIDTH-plant.width)//2, (HEIGHT-plant.height)//2), plant.getchannel("A"))
    return plate


def sample(image, seed):
    rng = np.random.default_rng(seed)
    raster = np.asarray(image, dtype=float).ravel()
    weight = raster**1.35
    indices = rng.choice(WIDTH*HEIGHT, size=COUNT, replace=True, p=weight/weight.sum())
    y, x = np.divmod(indices, WIDTH)
    x = np.clip(np.round((x+rng.uniform(-.5,.5,COUNT))*255/WIDTH),0,255).astype("uint8")
    y = np.clip(np.round((y+rng.uniform(-.5,.5,COUNT))*255/HEIGHT),0,255).astype("uint8")
    order = np.lexsort((y, np.where((x//12)%2,255-y,y), x//12))
    shades = np.clip(raster[indices]*.76+48,0,255).astype("uint8")
    return base64.b64encode(np.column_stack((x,y,shades))[order].tobytes()).decode()


if __name__ == "__main__":
    plates = {"zijincao": sample(zijincao(), 1937)}
    woody_names = ("magnolia","plum","cherry","coral","osmanthus","lilac","camellia")
    herb_names = ("lotus","iris","daylily","orchid","peony","chrysanthemum","hibiscus","jasmine","honeysuckle","tamarisk")
    for i, name in enumerate(woody_names + herb_names):
        art = Engraving()
        (tree_bloom if name in woody_names else herb)(art, name)
        plates[name] = sample(art.image, 500+i)
    (ATLAS/"field-studies.json").write_text(json.dumps(plates, separators=(",",":"))+"\n", encoding="utf-8", newline="\n")
