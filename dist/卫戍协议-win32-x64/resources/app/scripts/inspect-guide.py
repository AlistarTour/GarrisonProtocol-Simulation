from PIL import Image
from pathlib import Path
folder=Path('research/video')
for index in [1,2]:
    image=Image.open(folder/f'official-guide-{index}.jpg')
    print(index,image.size)
    for part,y in enumerate(range(0,image.height,1300)):
        image.crop((0,y,image.width,min(y+1300,image.height))).save(folder/f'guide-{index}-part-{part}.png')
