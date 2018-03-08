#!/usr/bin/env python
from __future__ import division, print_function
from PIL import Image, ImageDraw, ImageFont
import os
import sys

block_dir = 'smda/diesel/block'
try:
	os.makedirs(block_dir)
except OSError:
	pass

slices = 10
img_w, img_h = size = (256, 256)

fnt_path = '/Library/Fonts/Arial.ttf'
fnt = ImageFont.truetype(fnt_path, 40)

for sl in range(1, slices + 1):
	print('slice', sl)
	img_path = os.path.join(block_dir, 'slice_{0}.png'.format(sl))
	img = Image.new('RGBA', size, (0, 0, 255, 255))
	d = ImageDraw.Draw(img)
	message = 'slice {0}'.format(sl)
	w, h = d.textsize(message, font=fnt)
	d.text(((img_w - w) / 2, (img_h - h) / 2), message,
		font=fnt, fill=(0, 0, 0, 255))
	#Draw triangles on the corners of image
	xthird = img_w / 3
	ythird = img_h / 3
	#Upper left corner
	color = (255, 255, 0, 255)  # yellow
	d.polygon([(0, 0), (xthird, 0), (0, ythird)],
		fill=color, outline=color)
	#Upper right corner
	color = (0, 128, 0, 255)  # green
	d.polygon([(img_w, 0), (img_w - xthird, 0), (img_w, ythird)],
		fill=color, outline=color)
	#Lower right corner
	color = (128, 0, 128, 255)  # purple
	d.polygon([(img_w, img_h), (img_w - xthird, img_h), (img_w, img_h - ythird)],
		fill=color, outline=color)
	#Lower left corner
	color = (255, 128, 0, 255)  # orange
	d.polygon([(0, img_h), (xthird, img_h), (0, img_h - ythird)],
		fill=color, outline=color)
	img.save(img_path)
