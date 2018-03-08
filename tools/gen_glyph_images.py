#!/usr/bin/env python
from __future__ import division, print_function
from PIL import Image, ImageDraw, ImageFont
import os
import sys

glyph_dir = 'smda/lucky/glyphs/XXX/exvivo-1'
try:
	os.makedirs(glyph_dir)
except OSError:
	pass

slices = 1
min_slice = 53
max_slice = 53
min_row = 1
max_row = 4
min_col = 1
max_col = 4

img_w, img_h = size = (256, 256)

fnt_path = '/Library/Fonts/Arial.ttf'
fnt = ImageFont.truetype(fnt_path, 40)

for sl in range(min_slice, max_slice + 1):
	slice_path = os.path.join(glyph_dir, 'slice_{0}'.format(sl))
	try:
		os.makedirs(slice_path)
	except OSError:
		pass
	print('slice', sl)

	preview_img_path = os.path.join(slice_path, 'preview.png')
	preview_img = Image.new('RGBA', size, (0, 255, 0, 255))
	d = ImageDraw.Draw(preview_img)
	message = 'preview'
	w, h = d.textsize(message, font=fnt)
	d.text(((img_w - w) / 2, (img_h - h) / 2), message,
		font=fnt, fill=(0, 0, 0, 255))
	preview_img.save(preview_img_path)

	for row in range(1, max_row + 1):
		row_path = os.path.join(slice_path, 'row_{0}'.format(row))
		try:
			os.makedirs(row_path)
		except OSError:
			pass

		for col in range(1, max_col + 1):
			#print(col, row)
			img_path = os.path.join(row_path, 'col_{0}.png'.format(col))
			img = Image.new('RGBA', size, (0, 255, 0, 255))
			d = ImageDraw.Draw(img)
			message = '({0}, {1})'.format(col, row)
			w, h = d.textsize(message, font=fnt)
			d.text(((img_w - w) / 2, (img_h - h) / 2), message,
				font=fnt, fill=(255, 255, 255, 255))
			img.save(img_path)
