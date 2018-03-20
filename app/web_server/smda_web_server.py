"""
    smda_web_server.py
    Implements the smda web server as a Flask application
"""
from __future__ import division
import ConfigParser
import datetime
import hashlib
import json
import logging
import logging.handlers
import os
import pprint
import sys
import traceback
from flask import Flask, make_response, render_template, request, session
from werkzeug.contrib.cache import MemcachedCache

import model
import static_hash


#Set up flask app
app = Flask('smda_web_server', template_folder='/srv/smda/html/')
key_file = '/opt/smda/web_server/session.key'
if not os.path.isfile(key_file):
    import random
    with open(key_file, 'wb') as f:
        f.write(hex(random.getrandbits(2048))[2:-1])
app.config['SECRET_KEY'] = open(key_file, 'rb').read()
CSS_FOLDER = '/srv/smda/css'
IMG_FOLDER = '/srv/smda/img'
JS_FOLDER = '/srv/smda/js'

#Read the configuration and setting up logging
_config = ConfigParser.ConfigParser()
_config.read('/opt/smda/web_server/smda_web_server.cfg')
_log_filename = _config.get('logging', 'filename')
_log_maxbytes = _config.getint('logging', 'max_bytes')
_log_backupcount = _config.getint('logging', 'backup_count')
_log_level = _config.getint('logging', 'web_server_level')
app.logger.setLevel(_log_level)
_file_handler = logging.handlers.RotatingFileHandler(_log_filename,
    maxBytes=_log_maxbytes, backupCount=_log_backupcount)
_formatter = logging.Formatter('%(levelname)s %(asctime)s: %(message)s')
_file_handler.setFormatter(_formatter)
app.logger.addHandler(_file_handler)
if os.isatty(sys.stderr.fileno()):  # Log to terminal, if present
    _stream_handler = logging.StreamHandler()
    _stream_handler.setFormatter(_formatter)
    app.logger.addHandler(_stream_handler)

#Configure the cache system
memcached_host = _config.get('cache', 'memcache_host')
memcached_port = _config.get('cache', 'memcache_port')
app.cache = MemcachedCache((memcached_host, memcached_port))

#HTTP status codes
STAT_OK = 200
STAT_BAD_REQUEST = 400
STAT_UNAUTHORIZED = 401
STAT_NOT_FOUND = 404

#Content-Type values
TEXT_HTML_CONTENT = 'text/html; charset=utf-8'
JSON_CONTENT = 'application/json; charset=utf-8'

#Image route strings
ROUTE_DEFAULT_IMAGE = '/i/default'
ROUTE_BLOCK_IMAGE = '/i/<ui_id>/block/<int:slice_i>'
ROUTE_BLOCK_PREVIEW_IMAGE = '/i/<ui_id>/block/<int:slice_i>/preview'
ROUTE_HIST_IMAGE = ('/i/<ui_id>/hist/<stain>/<int:slice_i>/<int:level>/'
    '<int:row>/<int:col>')
ROUTE_HIST_PREVIEW_IMAGE = ('/i/<ui_id>/hist/<stain>/<int:slice_i>/'
    '<int:level>/preview')
ROUTE_MR_VOLUME_IMAGE = ('/i/<ui_id>/MR/<proc>/<vivo>/'
    '<int:session>/<volume>/<axis>/<int:slice_i>')
ROUTE_MR_NONVOLUME_IMAGE = ('/i/<ui_id>/MR/<proc>/<vivo>/'
    '<int:session>/<axis>/<int:slice_i>')
ROUTE_MR_VOLUME_PREVIEW_IMAGE = ('/i/<ui_id>/MR/<proc>/<vivo>/'
    '<int:session>/<volume>/<axis>/<int:slice_i>/preview')
ROUTE_MR_NONVOLUME_PREVIEW_IMAGE = ('/i/<ui_id>/MR/<proc>/<vivo>/'
    '<int:session>/<axis>/<int:slice_i>/preview')
ROUTE_LABEL_IMAGE = ('/i/<ui_id>/label/<label_type>/<axis>/<int:slice_i>')
ROUTE_LABEL_PREVIEW_IMAGE = (
    '/i/<ui_id>/label/<label_type>/<axis>/<int:slice_i>/preview')
ROUTE_LABEL_CONTOUR_IMAGE = ('/i/<ui_id>/contour/<label_type>/<axis>/<int:slice_i>')
ROUTE_GLYPH_IMAGE = ('/i/<ui_id>/glyph/<glyph_type>/<vivo>/<int:session>/'
    '<int:slice_i>/<int:row>/<int:col>')
ROUTE_GLYPH_PREVIEW_IMAGE = (
    '/i/<ui_id>/glyph/<glyph_type>/<vivo>/<int:session>/<int:slice_i>/'
    '<int:row>/<int:col>/preview')
ROUTE_AGGREGATE_MR_IMAGE = ('/i/<ui_id>/aMR/<proc>/<axis>/<int:slice_i>')
ROUTE_AGGREGATE_MR_PREVIEW_IMAGE = ('/i/<ui_id>/aMR/<proc>/<axis>/'
    '<int:slice_i>/preview')

app.cache.clear()

def get_hash(ext, filename):
    if ext == 'js':
        folder = JS_FOLDER
    elif ext == 'css':
        folder = CSS_FOLDER
    else:
        folder = IMG_FOLDER
    hash_key = static_hash.get_hash_key(filename, folder, ext)
    if hash_key:
        digest = app.cache.get(hash_key)
        if not digest:
            digest = static_hash.get_hash(filename, folder)
            app.logger.info('generated hash for {0}: {1}'.format(
                hash_key, digest))
            app.cache.set(hash_key, digest)
    else:
        digest = ''
    return digest

#Routes
@app.route('/')
@app.route('/<path:resource>')
def index(resource=None):
    """ Main page """
    return render_template('index.html', get_hash=get_hash)

def _make_info_response(info):
    headers = {'Content-Type': JSON_CONTENT}
    if info:
        response_body = json.dumps(info)
        status = STAT_OK
    else:
        response_body = ''
        status = STAT_BAD_REQUEST
    return make_response((response_body, status, headers))

@app.route('/info/subjects', methods=['GET'])
def get_subjects():
    return _make_info_response(model.get_subjects())

@app.route('/info/default', methods=['GET'])
def get_default_subject_info():
    ui_id = model.get_default_subject()
    return retrieve_subject_info(ui_id)

@app.route('/info/<ui_id>', methods=['GET'])
def get_subject_info(ui_id):
    return retrieve_subject_info(ui_id)

def retrieve_subject_info(ui_id):
    subject_key = 'subject_info[{0}]'.format(ui_id)
    info = app.cache.get(subject_key)
    if not info:
        info = model.get_subject_info(ui_id)
        if info:
            app.cache.set(subject_key, info)
            app.logger.debug('Set cache for subject data {0}'.format(
                ui_id))
    else:
        app.logger.debug('Retrieved cache version of subject data {0}'.format(
            ui_id))
    return _make_info_response(info)

def _make_image_request(img_path, prefix='/smda/atlasimg/', content_type='image/png'):
    if img_path:
        #X-Accel-Redirect field instructs nginx to serve the file.
        #The client does not see this internal response, but only the
        #response produced by nginx, which is basically the same as
        #below but without the X-Accel-Redirect field
        headers = {
            'X-Accel-Redirect': prefix + img_path,
            'Content-Type': content_type,
            #'Content-Disposition': 'filename="{0}"'.format(
            #    basename),
        }
        app.logger.debug('headers {0}'.format(headers))
        status = STAT_OK
    else:
        headers = {'Content-Type': TEXT_HTML_CONTENT}
        status = STAT_BAD_REQUEST
    return make_response(('', status, headers))

@app.route(ROUTE_DEFAULT_IMAGE, methods=['GET'])
def get_default_image():
    """ Gets the default image to be used when data is not available """
    return _make_image_request('VUIIS_Logo.png', prefix='/smda/img/main/')

@app.route(ROUTE_BLOCK_IMAGE, methods=['GET'])
def get_block_image(ui_id, slice_i):
    img_path = model.get_block_image_path(ui_id, slice_i)
    return _make_image_request(img_path)

@app.route(ROUTE_BLOCK_PREVIEW_IMAGE, methods=['GET'])
def get_block_preview_image(ui_id, slice_i):
    img_path = model.get_block_image_preview_path(ui_id, slice_i)
    return _make_image_request(img_path)

@app.route(ROUTE_HIST_IMAGE, methods=['GET'])
def get_hist_image(ui_id, stain, slice_i, level, row, col):
    img_path = model.get_hist_image_path(ui_id, stain, slice_i, level,
        row, col)
    return _make_image_request(img_path)

@app.route(ROUTE_HIST_PREVIEW_IMAGE, methods=['GET'])
def get_hist_preview_image(ui_id, stain, slice_i, level):
    img_path = model.get_hist_image_preview_path(ui_id, stain, slice_i,
        level)
    return _make_image_request(img_path)

@app.route(ROUTE_MR_VOLUME_IMAGE, methods=['GET'])
def get_mr_volume_image(ui_id, proc, vivo, session, volume, axis, slice_i):
    img_path = model.get_mr_image_path(ui_id, proc, session, vivo, volume,
        axis, slice_i)
    return _make_image_request(img_path)

@app.route(ROUTE_MR_NONVOLUME_IMAGE, methods=['GET'])
def get_mr_nonvolume_image(ui_id, proc, vivo, session, axis, slice_i):
    img_path = model.get_mr_image_path(ui_id, proc, session, vivo, None,
        axis, slice_i)
    return _make_image_request(img_path)

@app.route(ROUTE_MR_VOLUME_PREVIEW_IMAGE, methods=['GET'])
def get_mr_volume_preview_image(ui_id, proc, vivo, session, volume, axis,
        slice_i):
    img_path = model.get_mr_preview_image_path(ui_id, proc, session, vivo,
        volume, axis, slice_i)
    return _make_image_request(img_path)

@app.route(ROUTE_MR_NONVOLUME_PREVIEW_IMAGE, methods=['GET'])
def get_mr_nonvolume_preview_image(ui_id, proc, vivo, session, axis,
        slice_i):
    img_path = model.get_mr_preview_image_path(ui_id, proc, session, vivo,
        None, axis, slice_i)
    return _make_image_request(img_path)

@app.route(ROUTE_LABEL_IMAGE, methods=['GET'])
def get_label_image(ui_id, label_type, axis, slice_i):
    img_path = model.get_label_image_path(ui_id, label_type, axis, slice_i)
    return _make_image_request(img_path)

@app.route(ROUTE_LABEL_PREVIEW_IMAGE, methods=['GET'])
def get_label_image_preview(ui_id, label_type, axis, slice_i):
    img_path = model.get_label_image_preview_path(ui_id, label_type, axis,
        slice_i)
    return _make_image_request(img_path)

@app.route(ROUTE_LABEL_CONTOUR_IMAGE, methods=['GET'])
def get_label_contour_image(ui_id, label_type, axis, slice_i):
    contour_path = model.get_label_contour_path(ui_id, label_type, axis, slice_i)
    return _make_image_request(contour_path, content_type=TEXT_HTML_CONTENT)

@app.route(ROUTE_GLYPH_IMAGE, methods=['GET'])
def get_glyph_image(ui_id, glyph_type, vivo, session, slice_i, row, col):
    img_path = model.get_glyph_image_path(ui_id, glyph_type, vivo, session,
        slice_i, row, col)
    return _make_image_request(img_path)

@app.route(ROUTE_GLYPH_PREVIEW_IMAGE, methods=['GET'])
def get_glyph_image_preview(ui_id, glyph_type, vivo, session, slice_i,
        row, col):
    img_path = model.get_glyph_image_preview_path(ui_id, glyph_type, vivo,
        session, slice_i, row, col)
    return _make_image_request(img_path)

@app.route(ROUTE_AGGREGATE_MR_IMAGE, methods=['GET'])
def get_aggregate_mr_image(ui_id, proc, axis, slice_i):
    img_path = model.get_aggregate_mr_image_path(ui_id, proc, axis, slice_i)
    return _make_image_request(img_path)

@app.route(ROUTE_AGGREGATE_MR_PREVIEW_IMAGE, methods=['GET'])
def get_aggregate_mr_image_preview(ui_id, proc, axis, slice_i):
    img_path = model.get_aggregate_mr_image_preview_path(ui_id, proc, axis,
        slice_i)
    return _make_image_request(img_path)

if __name__ == '__main__':
    try:
        app.logger.info('smda_web_server start')
        server_port = _config.getint('server', 'port')
        app.run(host='0.0.0.0', port=server_port)
    except:
        msg = ''.join(traceback.format_exception(*sys.exc_info()))
        app.logger.error('Exception occurred:\n{0}'.format(msg))
        sys.exit(1)
