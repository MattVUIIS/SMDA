#!/usr/bin/env python
from __future__ import division, print_function
from PIL import Image, ImageDraw, ImageFont
import os
import sys

stain_dir = 'smda/lucky/hist/XXX'
try:
	os.makedirs(stain_dir)
except OSError:
	pass

slices = 1
max_level = 5
min_level = 2
img_w, img_h = size = (256, 256)

fnt_path = '/Library/Fonts/Arial.ttf'
fnt = ImageFont.truetype(fnt_path, 40)

for sl in range(1, slices + 1):
	slice_path = os.path.join(stain_dir, 'slice_{0}'.format(sl))
	try:
		os.makedirs(slice_path)
	except OSError:
		pass
	print('slice', sl)

	for level in range(min_level, max_level + 1):
		level_path = os.path.join(slice_path, 'level_{0}'.format(level))
		try:
			os.makedirs(level_path)
		except OSError:
			pass
		print('level', level)

		preview_img_path = os.path.join(level_path, 'preview.png')
		preview_img = Image.new('RGBA', size, (0, 0, 255, 255))
		d = ImageDraw.Draw(preview_img)
		message = 'preview'
		w, h = d.textsize(message, font=fnt)
		d.text(((img_w - w) / 2, (img_h - h) / 2), message,
			font=fnt, fill=(0, 0, 0, 255))
		preview_img.save(preview_img_path)

		max_row = 4**(max_level - level)
		max_col = max_row

		for row in range(1, max_row + 1):
			row_path = os.path.join(level_path, 'row_{0}'.format(row))
			try:
				os.makedirs(row_path)
			except OSError:
				pass

			for col in range(1, max_col + 1):
				print(col, row)
				img_path = os.path.join(row_path, 'col_{0}.png'.format(col))
				img = Image.new('RGBA', size, (0, 0, 255, 255))
				d = ImageDraw.Draw(img)
				message = '({0}, {1})'.format(col, row)
				w, h = d.textsize(message, font=fnt)
				d.text(((img_w - w) / 2, (img_h - h) / 2), message,
					font=fnt, fill=(0, 0, 0, 255))
				img.save(img_path)
