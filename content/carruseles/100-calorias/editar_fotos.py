"""Edita las fotos de fotos/ y las deja en fotos/editadas/ listas para el carrusel.

- Encuadre por alimento: la ración "densa" se ve pequeña con mucho aire alrededor
  y la de "mucho volumen" llena el panel, para exagerar el contraste.
- El fondo se extiende replicando los bordes cuando el encuadre se sale de la foto.
- Claras: se borran 2 cáscaras (8 → 6) para que cuadre con 100 kcal.

Uso: python3 content/carruseles/100-calorias/editar_fotos.py   (requiere pillow + numpy)
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).parent
SRC = HERE / "fotos"
OUT = SRC / "editadas"
PANEL = (1840, 820)  # 2× el panel del carrusel (920×410)
TILE = (540, 540)  # 2× la baldosa de portada
SHIFT = 0.13  # el alimento se desplaza a la derecha para dejar sitio a la ficha de texto (abajo a la izquierda)

# alimento: (centro x, centro y, alto del sujeto en px de la foto, fracción del panel que ocupa)
FRAMING = {
    "aceite": (600, 500, 310, 0.52),
    "fresas": (515, 520, 560, 0.94),
    "almendras": (510, 505, 390, 0.46),
    "manzana": (515, 505, 470, 0.92),
    "chocolate": (510, 495, 380, 0.46),
    "sandia": (702, 385, 470, 0.93),
    "refresco": (700, 368, 600, 0.78),
    "palomitas": (705, 392, 490, 0.9),
    "pollo": (700, 388, 555, 0.88),
    "claras": (703, 360, 545, 0.88),
}

# Para la portada: (centro x, centro y, lado del recorte cuadrado)
TILE_CROP = {
    "aceite": (560, 500, 620),
    "fresas": (515, 520, 640),
    "almendras": (510, 505, 560),
    "manzana": (515, 505, 580),
    "chocolate": (510, 495, 620),
    "sandia": (702, 385, 600),
}


def extend(img: Image.Image, pad: int) -> Image.Image:
    """Amplía el lienzo replicando los bordes y suaviza la zona añadida."""
    arr = np.asarray(img)
    big = Image.fromarray(np.pad(arr, ((pad, pad), (pad, pad), (0, 0)), mode="edge"))
    blurred = big.filter(ImageFilter.GaussianBlur(40))
    mask = Image.new("L", big.size, 255)
    ImageDraw.Draw(mask).rectangle((pad + 24, pad + 24, pad + img.width - 25, pad + img.height - 25), fill=0)
    mask = mask.filter(ImageFilter.GaussianBlur(24))
    return Image.composite(blurred, big, mask)


def crop(img: Image.Image, cx: float, cy: float, w: float, h: float, size) -> Image.Image:
    pad = int(max(w, h))
    big = extend(img, pad)
    box = (cx - w / 2 + pad, cy - h / 2 + pad, cx + w / 2 + pad, cy + h / 2 + pad)
    return big.crop(tuple(round(v) for v in box)).resize(size, Image.LANCZOS)


# Claras (foto 1408×768): centros de las 8 cáscaras y del bol.
SHELLS = [(705, 145), (518, 230), (887, 230), (455, 385), (952, 385), (518, 545), (705, 600), (882, 545)]
BOWL = (705, 395, 172)
REMOVE = [(455, 385), (952, 385)]  # izquierda y derecha del medio → quedan 6


def box_blur(a: np.ndarray, r: int, passes: int = 3) -> np.ndarray:
    """Desenfoque casi gaussiano en coma flotante (3 pasadas de caja, bordes replicados)."""
    for _ in range(passes):
        for axis in (0, 1):
            pad = [(0, 0)] * a.ndim
            pad[axis] = (r + 1, r)
            c = np.cumsum(np.pad(a, pad, mode="edge"), axis=axis, dtype=np.float64)
            hi = np.take(c, range(2 * r + 1, c.shape[axis]), axis=axis)
            lo = np.take(c, range(0, c.shape[axis] - 2 * r - 1), axis=axis)
            a = ((hi - lo) / (2 * r + 1)).astype(np.float32)
    return a


def remove_shells(img: Image.Image) -> Image.Image:
    """Borra 2 cáscaras reconstruyendo el fondo con un desenfoque normalizado que ignora los objetos."""
    w, h = img.size
    objects = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(objects)
    for x, y in SHELLS:  # cáscara + su sombra (la luz viene de la izquierda)
        d.ellipse((x - 84, y - 84, x + 84, y + 84), fill=255)
        d.ellipse((x - 60, y - 76, x + 170, y + 130), fill=255)
    bx, by, br = BOWL
    d.ellipse((bx - br - 30, by - br - 30, bx + br + 60, by + br + 50), fill=255)

    arr = np.asarray(img).astype(np.float32)
    known = 1 - np.asarray(objects).astype(np.float32)[..., None] / 255
    num = box_blur(arr * known, 60)
    den = box_blur(known, 60)
    bg = num / np.maximum(den, 1e-4)
    bg += np.random.default_rng(1).normal(0, 1.2, bg.shape)  # grano suave para que no quede plano

    hole = Image.new("L", (w, h), 0)
    dh = ImageDraw.Draw(hole)
    for x, y in REMOVE:
        dh.ellipse((x - 100, y - 100, x + 100, y + 100), fill=255)
        dh.ellipse((x - 50, y - 72, x + 160, y + 124), fill=255)
    hole = hole.filter(ImageFilter.GaussianBlur(10))
    ImageDraw.Draw(hole).ellipse((bx - br - 4, by - br - 4, bx + br + 4, by + br + 4), fill=0)  # el bol no se toca
    hole = np.asarray(hole.filter(ImageFilter.GaussianBlur(3))).astype(np.float32)[..., None] / 255
    return Image.fromarray((arr * (1 - hole) + bg * hole).clip(0, 255).astype(np.uint8))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for food, (cx, cy, subject, frac) in FRAMING.items():
        img = Image.open(SRC / f"{food}.jpg").convert("RGB")
        if food == "claras":
            img = remove_shells(img)
        h = subject / frac
        w = h * PANEL[0] / PANEL[1]
        crop(img, cx - SHIFT * w, cy, w, h, PANEL).save(OUT / f"{food}.jpg", quality=92)
        if food in TILE_CROP:
            tx, ty, side = TILE_CROP[food]
            crop(img, tx, ty, side, side, TILE).save(OUT / f"{food}-tile.jpg", quality=92)
        print(food)


if __name__ == "__main__":
    main()
