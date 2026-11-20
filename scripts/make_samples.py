"""Creates fictional sample prescriptions (no real patient/doctor) + the expected AI reading for demo mode."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import random, json, math
random.seed(7)
W, H = 1000, 1400
HAND = '/home/claude/caveat500.ttf'; HANDB = '/home/claude/caveat700.ttf'
SERIF = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'; SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
INK = (28, 46, 120)

def paper():
    im = Image.new('RGB', (W, H), (250, 247, 238))
    px = im.load()
    for _ in range(60000):
        x, y = random.randrange(W), random.randrange(H); c = random.randint(-10, 6)
        r, g, b = px[x, y]; px[x, y] = (r + c, g + c, b + c)
    return im

def hand_line(im, x, y, text, size=58, slant=-2.5):
    layer = Image.new('RGBA', (W, 140), (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    f = ImageFont.truetype(HAND, size); cx = 6
    for ch in text:
        dy = random.uniform(-3, 3); s = size + random.randint(-3, 3)
        ff = ImageFont.truetype(HAND, s)
        d.text((cx, 30 + dy), ch, font=ff, fill=INK + (random.randint(215, 255),))
        cx += ff.getlength(ch) * random.uniform(0.86, 0.96)
    layer = layer.rotate(slant + random.uniform(-1, 1), resample=Image.BICUBIC, center=(0, 70))
    im.paste(layer, (x, y - 30), layer)
    return (x, y - 5, min(W - 10, x + int(cx) + 10), y + int(size * 1.15))

def letterhead(d, doctor, clinic, addr):
    d.rectangle([0, 0, W, 190], fill=(232, 240, 250))
    d.text((60, 40), doctor, font=ImageFont.truetype(SERIF, 44), fill=(20, 40, 90))
    d.text((60, 100), 'MBBS, MD (General Medicine)  ·  Reg. No. 00000 (sample)', font=ImageFont.truetype(SANS, 20), fill=(60, 70, 100))
    d.text((60, 135), f'{clinic}  ·  {addr}', font=ImageFont.truetype(SANS, 20), fill=(60, 70, 100))
    d.line([(60, 215), (W - 60, 215)], fill=(150, 160, 190), width=2)
    d.text((60, 235), 'Name: ______________________   Age: ____   Date: ____________', font=ImageFont.truetype(SANS, 22), fill=(90, 95, 115))
    d.text((60, 300), 'Rx', font=ImageFont.truetype(SERIF, 64), fill=(20, 40, 90))
    d.text((60, H - 90), 'SAMPLE PRESCRIPTION FOR DEMO — NOT A REAL DOCUMENT', font=ImageFont.truetype(SANS, 20), fill=(190, 60, 60))

def photo(im):
    im = im.rotate(-1.2, resample=Image.BICUBIC, fillcolor=(70, 66, 60))
    vign = Image.new('L', (W, H), 0); vd = ImageDraw.Draw(vign)
    for i in range(40): vd.ellipse([-400 + i * 10, -300 + i * 10, W + 400 - i * 10, H + 300 - i * 10], fill=int(i * 6.4))
    dark = Image.new('RGB', (W, H), (40, 36, 30))
    im = Image.composite(im, dark, vign.filter(ImageFilter.GaussianBlur(60)).point(lambda v: min(255, v + 120)))
    return im.filter(ImageFilter.GaussianBlur(0.6))

SAMPLES = [
  dict(id='fever', title='Fever & throat infection', doctor='Dr. Aditi Mehra', clinic='Sunrise Clinic', addr='Sector 45, Gurugram',
       lines=[
         ('Tab Augmentin 625 Duo   1-0-1  x 5d  PC', dict(name='Augmentin 625 Duo', form='tablet', dosage_as_written='1-0-1', duration_as_written='x 5d', food='after', amount='', confidence=0.93)),
         ('Tab Pan 40   1-0-0  x 5d  AC', dict(name='Pan 40', form='tablet', dosage_as_written='1-0-0', duration_as_written='x 5d', food='before', amount='', confidence=0.9)),
         ('Tab Montair LC   0-0-1  x 7 days', dict(name='Montair LC', form='tablet', dosage_as_written='0-0-1', duration_as_written='x 7 days', food='', amount='', confidence=0.86)),
         ('Syp Ascoril LS   5ml  TDS  x 5d', dict(name='Ascoril LS', form='syrup', dosage_as_written='TDS', duration_as_written='x 5d', food='', amount='5 ml', confidence=0.81)),
         ('Tab Dolo 650   SOS (fever > 100°F)', dict(name='Dolo 650', form='tablet', dosage_as_written='SOS', duration_as_written='', food='', amount='', confidence=0.95)),
       ], advice=['Plenty of warm fluids', 'Rest for 3 days', 'Review after 5 days if fever persists']),
  dict(id='bp', title='Diabetes & BP (monthly)', doctor='Dr. Rahul Bansal', clinic='CareFirst Diabetes Centre', addr='DLF Phase 3, Gurugram',
       lines=[
         ('Tab Telma 40   1-0-0  x 1 month', dict(name='Telma 40', form='tablet', dosage_as_written='1-0-0', duration_as_written='x 1 month', food='', amount='', confidence=0.92)),
         ('Tab Glycomet GP 1   1-0-1  AC  x 30d', dict(name='Glycomet GP 1', form='tablet', dosage_as_written='1-0-1', duration_as_written='x 30d', food='before', amount='', confidence=0.84)),
         ('Tab Rosuvas 10   0-0-1  HS  x 30d', dict(name='Rosuvas 10', form='tablet', dosage_as_written='0-0-1 HS', duration_as_written='x 30d', food='', amount='', confidence=0.8)),
       ], advice=['Walk 30 min daily', 'Check sugar fasting & PP weekly', 'Low salt diet']),
]
out = []
for s in SAMPLES:
    im = paper(); d = ImageDraw.Draw(im)
    letterhead(d, s['doctor'], s['clinic'], s['addr'])
    meds = []; y = 420
    for text, info in s['lines']:
        x0, y0, x1, y1 = hand_line(im, 130 + random.randint(-10, 10), y, text)
        info = dict(info, as_written=text, box_2d=[round(y0 / H * 1000), round(x0 / W * 1000), round(y1 / H * 1000), round(x1 / W * 1000)])
        meds.append(info); y += 125 + random.randint(-8, 12)
    y += 30
    hand_line(im, 110, y, 'Adv: ' + ', '.join(s['advice'][:2]), size=46)
    hand_line(im, 600, H - 220, s['doctor'].split()[-1] + ' ~', size=64, slant=6)
    im = photo(im)
    im.save(f"public/samples/{s['id']}.jpg", quality=86)
    out.append(dict(id=s['id'], title=s['title'], image=f"samples/{s['id']}.jpg", reading=dict(medicines=meds, advice=s['advice'])))
json.dump(out, open('public/samples/samples.json', 'w'), indent=1)
print('done')
