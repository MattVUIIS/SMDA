"""
    model.py
    Manages the smda database
"""
import ConfigParser
import logging
import os
import psycopg2
import psycopg2.extras

from six.moves import configparser


_app_config = configparser.ConfigParser()
_app_config.read('/opt/smda/smda-app.cfg')
DATE_FORMAT = _app_config.get('database', 'date_format')
amqp_connect_str = _app_config.get('messaging', 'amqp_connect_str')

_db_config = configparser.ConfigParser()
_db_config.read('/opt/smda/smda-db.cfg')
connect_str = _db_config.get('database', 'connect_str')

_config = configparser.ConfigParser()
_config.read('/opt/smda/web_server/smda_web_server.cfg')
atlas_root = _config.get('atlas', 'root')

QUERY_GET_SUBJECTS = """
SELECT display_name, ui_id FROM "subject"
ORDER BY display_name
"""

QUERY_GET_SUBJECT_INFO = """
SELECT subject_id, display_name FROM "subject" WHERE ui_id = (%s)
"""

QUERY_GET_DEFAULT_SUBJECT = """
SELECT default_ui_id FROM "subject_meta"
LIMIT 1
"""

QUERY_GET_BLOCK_MODALITY = """
SELECT block_mod_id, image_w, image_h, min_slice, max_slice, attrib_id
FROM "block_modality" NATURAL JOIN "subject" s
WHERE s.subject_id = (%s)
"""

QUERY_GET_BLOCK_HOLES = """
SELECT slice
FROM "block_slice"
WHERE block_mod_id = (%s) AND file_path IS NULL
"""

QUERY_GET_HIST_MODALITY = """
SELECT hm.hist_mod_id, hm.magnification_factor, hm.min_slice, hm.max_slice, hs.stain, hm.attrib_id
FROM "histology_modality" hm NATURAL JOIN "subject" s NATURAL JOIN "histology_stain" hs
WHERE s.subject_id = (%s)
"""

QUERY_GET_HIST_LEVELS = """
SELECT hist_level_id, level, image_w, image_h, min_row, max_row, min_col, max_col
FROM "histology_level"
WHERE hist_mod_id = (%s)
ORDER BY level
"""

QUERY_GET_MR_MODALITY = """
SELECT mt.mr_type, mt.has_volumes, ms.mr_session_id, ms.session, ms.invivo, ms.volume
FROM "mr_modality" mm NATURAL JOIN "subject" s NATURAL JOIN "mr_type" mt NATURAL JOIN "mr_session" ms
WHERE s.subject_id = (%s)
"""

QUERY_GET_MR_VOLUME_AXIS = """
SELECT a.axis, mva.image_w, mva.image_h, mva.min_slice, mva.max_slice, mva.attrib_id
FROM "mr_volume_axis" mva NATURAL JOIN "axis" a
WHERE mva.mr_session_id = (%s)
"""

QUERY_GET_LABEL_MODALITY = """
SELECT lt.label_type, lm.label_mod_id
FROM "label_modality" lm NATURAL JOIN "subject" s NATURAL JOIN "label_type" lt
WHERE s.subject_id = (%s)
"""

QUERY_GET_LABEL_AXIS = """
SELECT a.axis, lva.image_w, lva.image_h, lva.min_slice, lva.max_slice, lva.attrib_id
FROM "axis" a NATURAL JOIN "label_volume_axis" lva
WHERE lva.label_mod_id = (%s)
"""

QUERY_GET_GLYPH_MODALITY = """
SELECT gm.glyph_mod_id, gt.glyph_type
FROM "glyph_modality" gm NATURAL JOIN "subject" s NATURAL JOIN "glyph_type" gt
WHERE s.subject_id = (%s)
"""

QUERY_GET_GLYPH_SESSION = """
SELECT gs.session, gs.invivo, gs.min_slice, gs.max_slice, gs.image_w,
gs.image_h, gs.min_row, gs.max_row, gs.min_col, gs.max_col, gs.attrib_id
FROM "glyph_session" gs
WHERE gs.glyph_mod_id = (%s)
"""

QUERY_GET_AGGREGATE_MR_MODALITY = """
SELECT amt.amr_type, amm.amr_mod_id
FROM "aggregate_mr_modality" amm NATURAL JOIN "subject" s NATURAL JOIN "aggregate_mr_type" amt
WHERE s.subject_id = (%s)
"""

QUERY_GET_AGGREGATE_MR_VOLUME_AXIS = """
SELECT a.axis, amva.image_w, amva.image_h, amva.min_slice, amva.max_slice, amva.attrib_id
FROM "aggregate_mr_volume_axis" amva NATURAL JOIN "axis" a
WHERE amva.amr_mod_id = (%s)
"""

QUERY_GET_ATTRIBUTES = """
SELECT *
FROM "modality_attributes"
WHERE attrib_id = (%s)
"""

QUERY_GET_BLOCK_SLICE_PATH = """
SELECT bs.file_path
FROM "block_modality" bm NATURAL JOIN "subject" s NATURAL JOIN "block_slice" bs
WHERE s.ui_id = (%s) AND bs.slice = (%s)
"""

QUERY_GET_HISTOLOGY_IMAGE_TEMPLATE = """
SELECT hs.file_path_template
FROM "histology_slice" hs NATURAL JOIN "subject" s NATURAL JOIN "histology_stain" hst NATURAL JOIN "histology_modality" hmd
WHERE s.ui_id = (%s) AND hst.stain = (%s) AND hs.slice = (%s)
"""

QUERY_GET_HISTOLOGY_PREVIEW_TEMPLATE = """
SELECT hs.preview_path_template
FROM "histology_slice" hs NATURAL JOIN "subject" s NATURAL JOIN "histology_stain" hst NATURAL JOIN "histology_modality" hmd
WHERE s.ui_id = (%s) AND hst.stain = (%s) AND hs.slice = (%s)
"""

QUERY_GET_NO_VOLUME_MR_SLICE_PATH = """
SELECT ms.file_path
FROM "subject" s NATURAL JOIN "mr_modality" mm NATURAL JOIN "mr_type" mrt NATURAL JOIN "mr_session" mse
NATURAL JOIN "mr_volume_axis" mva NATURAL JOIN "axis" a NATURAL JOIN "mr_slice" ms
WHERE s.ui_id = (%s) AND mrt.mr_type = (%s) AND mse.session = (%s) AND mse.invivo = (%s)
AND mse.volume IS NULL AND a.axis = (%s) AND ms.slice = (%s)
"""

QUERY_GET_VOLUME_MR_SLICE_PATH = """
SELECT ms.file_path
FROM "subject" s NATURAL JOIN "mr_modality" mm NATURAL JOIN "mr_type" mrt NATURAL JOIN "mr_session" mse
NATURAL JOIN "mr_volume_axis" mva NATURAL JOIN "axis" a NATURAL JOIN "mr_slice" ms
WHERE s.ui_id = (%s) AND mrt.mr_type = (%s) AND mse.session = (%s) AND mse.invivo = (%s)
AND mse.volume = (%s) AND a.axis = (%s) AND ms.slice = (%s)
"""

QUERY_GET_LABEL_SLICE_PATH = """
SELECT ls.file_path
FROM "subject" s NATURAL JOIN "label_modality" lm NATURAL JOIN "label_type" lt
NATURAL JOIN "label_volume_axis" lva NATURAL JOIN "axis" a NATURAL JOIN "label_slice" ls
WHERE s.ui_id = (%s) AND lt.label_type = (%s) AND a.axis = (%s) AND ls.slice = (%s)
"""

QUERY_GET_LABEL_CONTOUR_PATH = """
SELECT ls.contour_file_path
FROM "subject" s NATURAL JOIN "label_modality" lm NATURAL JOIN "label_type" lt
NATURAL JOIN "label_volume_axis" lva NATURAL JOIN "axis" a NATURAL JOIN "label_slice" ls
WHERE s.ui_id = (%s) AND lt.label_type = (%s) AND a.axis = (%s) AND ls.slice = (%s)
"""

QUERY_GET_GLYPH_IMAGE_TEMPLATE = """
SELECT gs.file_path_template
FROM "subject" s NATURAL JOIN "glyph_type" gt NATURAL JOIN "glyph_modality" gm NATURAL JOIN "glyph_session" gse NATURAL JOIN "glyph_slice" gs
WHERE s.ui_id = (%s) AND gt.glyph_type = (%s) AND gse.session = (%s) AND gse.invivo = (%s) AND gs.slice = (%s)
"""

QUERY_GET_GLYPH_IMAGE_PREVIEW_TEMPLATE = """
SELECT gs.preview_path_template
FROM "subject" s NATURAL JOIN "glyph_type" gt NATURAL JOIN "glyph_modality" gm NATURAL JOIN "glyph_session" gse NATURAL JOIN "glyph_slice" gs
WHERE s.ui_id = (%s) AND gt.glyph_type = (%s) AND gse.session = (%s) AND gse.invivo = (%s) AND gs.slice = (%s)
"""

QUERY_GET_AGGREGATE_MR_SLICE_PATH = """
SELECT ams.file_path
FROM "subject" s NATURAL JOIN "aggregate_mr_modality" amm NATURAL JOIN "aggregate_mr_type" amt
NATURAL JOIN "aggregate_mr_volume_axis" amva NATURAL JOIN "axis" a NATURAL JOIN "aggregate_mr_slice" ams
WHERE s.ui_id = (%s) AND amt.amr_type = (%s) AND a.axis = (%s) AND ams.slice = (%s)
"""

def _get_attrib(db_conn, attrib_id):
    c = db_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    c.execute(QUERY_GET_ATTRIBUTES, (attrib_id,))
    attrib = c.fetchone()
    del attrib['attrib_id']
    attrib = dict([(k, v) for k, v in attrib.items() if v is not None])
    return attrib

def get_subjects():
    logger = logging.getLogger('smda_web_server')
    with psycopg2.connect(connect_str) as db_conn:
        c = db_conn.cursor()
        c.execute(QUERY_GET_SUBJECTS)
        subjects = []
        for display_name, ui_id in c.fetchall():
            subjects.append({
                'subject': display_name,
                'id': str(ui_id),
            })
    return subjects

def get_default_subject():
    ui_id = None
    with psycopg2.connect(connect_str) as db_conn:
        c = db_conn.cursor()
        c.execute(QUERY_GET_DEFAULT_SUBJECT)
        row = c.fetchone()
        if row:
            ui_id = row[0]
    return ui_id

def get_subject_info(ui_id):
    info = None
    with psycopg2.connect(connect_str) as db_conn:
        c = db_conn.cursor()
        c.execute(QUERY_GET_SUBJECT_INFO, (ui_id,))
        row = c.fetchone()
        if row:
            subject_id, display_name = row
            info = {
                'subject': display_name,
                'id': str(ui_id),
                'modes': {
                    'block': get_block_info(subject_id),
                    'hist': get_hist_info(subject_id),
                    'MR': get_mr_info(subject_id),
                    'labels': get_label_info(subject_id),
                    'glyphs': get_glyph_info(subject_id),
                    'aggregateMR': get_aggregate_mr_info(subject_id),
                },
                'subjects': get_subjects(),
            }
    return info

def get_block_info(subject_id):
    logger = logging.getLogger('smda_web_server')
    info = None
    with psycopg2.connect(connect_str) as db_conn:
        c = db_conn.cursor()
        c.execute(QUERY_GET_BLOCK_MODALITY, (subject_id,))
        row = c.fetchone()
        if row:
            block_mod_id, image_w, image_h, min_slice, max_slice, attrib_id = row
            c.execute(QUERY_GET_BLOCK_HOLES, (block_mod_id,))
            slice_holes = list(c.fetchall())
            logger.debug('got attrib_id: {0}'.format(attrib_id))
            #logger.debug('slice holes: {0}'.format(slice_holes))
            info = {
                'image_w': image_w,
                'image_h': image_h,
                'min_slice': min_slice,
                'max_slice': max_slice,
                'slice_holes': slice_holes,
            }
            if attrib_id:
                info['attrib'] = _get_attrib(db_conn, attrib_id)
    return info


def get_hist_info(subject_id):
    logger = logging.getLogger('smda_web_server')
    #logger.debug('get_hist_info for {0}'.format(subject_id))
    info = None
    with psycopg2.connect(connect_str) as db_conn:
        c = db_conn.cursor()
        c.execute(QUERY_GET_HIST_MODALITY, (subject_id,))
        if c.rowcount:
            stains = {}
            for hist_mod_id, mag_factor, min_slice, max_slice, stain, attrib_id in c.fetchall():
                c2 = db_conn.cursor()
                c2.execute(QUERY_GET_HIST_LEVELS, (hist_mod_id,))
                levels = {}
                for (hist_level_id, level, image_w, image_h, min_row, max_row,
                        min_col, max_col) in c2.fetchall():
                    levels[level] = {
                        'image_w': image_w,
                        'image_h': image_h,
                        'min_row': min_row,
                        'max_row': max_row,
                        'min_col': min_col,
                        'max_col': max_col,
                    }
                try:
                    stains[stain] = {
                        'mag_factor': mag_factor,
                        'min_slice': min_slice,
                        'max_slice': max_slice,
                        'image_w': image_w,
                        'image_h': image_h,
                        'levels': levels,
                    }
                except NameError as e:
                    #In case image_w or image_h wasn't defined
                    logger.exception('exception: {0}'.format(e))
                if attrib_id:
                    stains[stain]['attrib'] = _get_attrib(db_conn, attrib_id)
            info = stains
    return info

def get_mr_info(subject_id):
    logger = logging.getLogger('smda_web_server')
    #logger.debug('get_mr_info for {0}'.format(subject_id))
    info = None
    with psycopg2.connect(connect_str) as db_conn:
        c = db_conn.cursor()
        c2 = db_conn.cursor()
        c.execute(QUERY_GET_MR_MODALITY, (subject_id,))
        if c.rowcount:
            mr = {}
            for (mr_type, has_volumes, mr_session_id, session, invivo,
                    volume) in c.fetchall():
                #logger.debug('retrieved: {0} {1} {2} {3} {4}'.format(mr_type,
                #    has_volumes, session, invivo, volume))
                mr_info = mr.get(mr_type)
                if not mr_info:
                    mr[mr_type] = mr_info = {}
                sessions = mr_info.get('sessions')
                if not sessions:
                    mr_info['sessions'] = sessions = {}
                    mr_info['has_volumes'] = has_volumes
                    mr_info['session_names'] = session_names = []
                session_info = sessions.get(session)
                if not session_info:
                    sessions[session] = session_info = {}
                vivo = 'invivo' if invivo == 1 else 'exvivo'
                session_name = '{0}-{1}'.format(vivo, session)
                if session_name not in session_names:
                    session_names.append(session_name)
                if has_volumes:
                    volume_info = session_info.get(vivo)
                    if not volume_info:
                        session_info[vivo] = volume_info = {}
                    vivo_info = volume_info.get(volume)
                    if not vivo_info:
                        volume_info[volume] = vivo_info = {}
                else:
                    vivo_info = session_info.get(vivo)
                    if not vivo_info:
                        session_info[vivo] = vivo_info = {}

                c2.execute(QUERY_GET_MR_VOLUME_AXIS, (mr_session_id,))
                for axis, image_w, image_h, min_slice, max_slice, attrib_id in c2.fetchall():
                    vivo_info[axis] = {
                        'image_w': image_w,
                        'image_h': image_h,
                        'min_slice': min_slice,
                        'max_slice': max_slice,
                    }
                    if attrib_id:
                        vivo_info['attrib'] = _get_attrib(db_conn, attrib_id)
            info = mr
    return info

def get_label_info(subject_id):
    logger = logging.getLogger('smda_web_server')
    #logger.debug('get_label_info for {0}'.format(subject_id))
    info = None
    with psycopg2.connect(connect_str) as db_conn:
        c = db_conn.cursor()
        c.execute(QUERY_GET_LABEL_MODALITY, (subject_id,))
        if c.rowcount:
            labels = {}
            for label_type, label_mod_id in c.fetchall():
                c2 = db_conn.cursor()
                c2.execute(QUERY_GET_LABEL_AXIS, (label_mod_id,))
                axes = {}
                for axis, image_w, image_h, min_slice, max_slice, attrib_id in c2.fetchall():
                    axes[axis] = {
                        'image_w': image_w,
                        'image_h': image_h,
                        'min_slice': min_slice,
                        'max_slice': max_slice,
                    }
                    if attrib_id:
                        axes[axis]['attrib'] = _get_attrib(db_conn, attrib_id)
                labels[label_type] = axes
            info = labels
    return info

def get_glyph_info(subject_id):
    logger = logging.getLogger('smda_web_server')
    #logger.debug('get_glpyh_info for {0}'.format(subject_id))
    glyphs = None
    with psycopg2.connect(connect_str) as db_conn:
        c = db_conn.cursor()
        c.execute(QUERY_GET_GLYPH_MODALITY, (subject_id,))
        if c.rowcount:
            glyphs = {}
            for glyph_mod_id, glyph_type in c.fetchall():
                c2 = db_conn.cursor()
                c2.execute(QUERY_GET_GLYPH_SESSION, (glyph_mod_id,))
                sessions = {}
                session_names = []
                for (session, invivo, min_slice, max_slice, image_w, image_h,
                        min_row, max_row, min_col, max_col, attrib_id) in c2.fetchall():
                    sess_info = sessions.get(session)
                    if not sess_info:
                        sess_info = sessions[session] = {}
                    vivo = 'invivo' if invivo == 1 else 'exvivo'
                    session_name = '{0}-{1}'.format(vivo, session)
                    if session_name not in session_names:
                        session_names.append(session_name)
                    vivo_info = {
                        'min_slice': min_slice,
                        'max_slice': max_slice,
                        'image_w': image_w,
                        'image_h': image_h,
                        'min_row': min_row,
                        'max_row': max_row,
                        'min_col': min_col,
                        'max_col': max_col,
                    }
                    if attrib_id:
                        vivo_info['attrib'] = _get_attrib(db_conn, attrib_id)
                    sess_info[vivo] = vivo_info
                glyphs[glyph_type] = {
                    'sessions': sessions,
                    'session_names': session_names,
                }
            logger.debug('glyphs: {0}'.format(glyphs))
    return glyphs

def get_aggregate_mr_info(subject_id):
    logger = logging.getLogger('smda_web_server')
    #logger.debug('get_mr_info for {0}'.format(subject_id))
    amr = None
    with psycopg2.connect(connect_str) as db_conn:
        c = db_conn.cursor()
        c2 = db_conn.cursor()
        c.execute(QUERY_GET_AGGREGATE_MR_MODALITY, (subject_id,))
        if c.rowcount:
            amr = {}
            for amr_type, amr_mod_id in c.fetchall():
                #logger.debug('retrieved: {0} {1} {2} {3} {4}'.format(mr_type,
                #    has_volumes, session, invivo, volume))
                amr_info = amr.get(amr_type)
                if not amr_info:
                    amr[amr_type] = amr_info = {}
                axis_info = amr_info.get('all_sessions')
                if not axis_info:
                    amr_info['all_sessions'] = axis_info = {}
                c2.execute(QUERY_GET_AGGREGATE_MR_VOLUME_AXIS, (amr_mod_id,))
                for axis, image_w, image_h, min_slice, max_slice, attrib_id in c2.fetchall():
                    axis_info[axis] = {
                        'image_w': image_w,
                        'image_h': image_h,
                        'min_slice': min_slice,
                        'max_slice': max_slice,
                    }
                    if attrib_id:
                        axis_info[axis]['attrib'] = _get_attrib(db_conn, attrib_id)
    return amr

def _check_image_path(img_path):
    logger = logging.getLogger('smda_web_server')
    #logger.debug('img_path: {0}'.format(img_path))
    if img_path:
        full_img_path = os.path.join(atlas_root, img_path)
        #if os.path.exists(full_img_path):
        #    logger.debug('path exists: {0}'.format(full_img_path))
        #    return img_path
        #logger.error('path does not exist: {0}'.format(full_img_path))
        return img_path
    return None

def get_block_image_path(ui_id, slice_i):
    img_path = None
    with psycopg2.connect(connect_str) as db_conn:
        c = db_conn.cursor()
        c.execute(QUERY_GET_BLOCK_SLICE_PATH, (ui_id, slice_i))
        if c.rowcount:
            img_path = c.fetchone()[0]
    return _check_image_path(img_path)

def get_block_image_preview_path(ui_id, slice_i):
    return get_block_image_path(ui_id, slice_i)

def get_hist_image_path(ui_id, stain, slice_i, level, row, col):
    logger = logging.getLogger('smda_web_server')
    img_path = None
    with psycopg2.connect(connect_str) as db_conn:
        c = db_conn.cursor()
        c.execute(QUERY_GET_HISTOLOGY_IMAGE_TEMPLATE, (ui_id, stain, slice_i))
        if c.rowcount:
            file_path_template = c.fetchone()[0]
            logger.debug('hist image: got file_path_template: {0}'.format(
                file_path_template))
            img_path = file_path_template.format(level=level, row=row, col=col)
            logger.debug('hist image: got img_path: {0}'.format(img_path))
    return _check_image_path(img_path)

def get_hist_image_preview_path(ui_id, stain, slice_i, level):
    logger = logging.getLogger('smda_web_server')
    img_path = None
    with psycopg2.connect(connect_str) as db_conn:
        c = db_conn.cursor()
        c.execute(QUERY_GET_HISTOLOGY_PREVIEW_TEMPLATE, (ui_id, stain, slice_i))
        if c.rowcount:
            preview_path_template = c.fetchone()[0]
            logger.debug('hist preview: got preview_path_template: {0}'.format(
                preview_path_template))
            img_path = preview_path_template.format(level=level)
            logger.debug('hist preview: got img_path: {0}'.format(img_path))
    return _check_image_path(img_path)

def get_mr_image_path(ui_id, proc, session, vivo, volume, axis, slice_i):
    logger = logging.getLogger('smda_web_server')
    img_path = None
    with psycopg2.connect(connect_str) as db_conn:
        c = db_conn.cursor()
        invivo = 1 if vivo == 'invivo' else 0
        if volume:
            try:
                volume = int(volume)
                c.execute(QUERY_GET_VOLUME_MR_SLICE_PATH, (ui_id, proc, session,
                    invivo, volume, axis, slice_i))
            except ValueError:
                logger.debug('Failed to convert volume "{0}" to int'.format(
                    volume))
                return None
        else:
            c.execute(QUERY_GET_NO_VOLUME_MR_SLICE_PATH, (ui_id, proc,
                session, invivo, axis, slice_i))
        if c.rowcount:
            img_path = c.fetchone()[0]
    return _check_image_path(img_path)

def get_mr_preview_image_path(ui_id, proc, session, vivo, volume, axis, slice_i):
    return get_mr_image_path(ui_id, proc, session, vivo, volume, axis, slice_i)

def get_label_image_path(ui_id, label_type, axis, slice_i):
    logger = logging.getLogger('smda_web_server')
    img_path = None
    with psycopg2.connect(connect_str) as db_conn:
        c = db_conn.cursor()
        c.execute(QUERY_GET_LABEL_SLICE_PATH, (ui_id, label_type, axis, slice_i))
        if c.rowcount:
            img_path = c.fetchone()[0]
    return _check_image_path(img_path)

def get_label_image_preview_path(ui_id, label_type, axis, slice_i):
    return get_label_image_path(ui_id, label_type, axis, slice_i)

def get_label_contour_path(ui_id, label_type, axis, slice_i):
    logger = logging.getLogger('smda_web_server')
    contour_path = None
    with psycopg2.connect(connect_str) as db_conn:
        c = db_conn.cursor()
        c.execute(QUERY_GET_LABEL_CONTOUR_PATH, (ui_id, label_type, axis, slice_i))
        if c.rowcount:
            contour_path = c.fetchone()[0]
    return _check_image_path(contour_path)

def get_glyph_image_path(ui_id, glyph_type, vivo, session, slice_i, row, col):
    img_path = None
    with psycopg2.connect(connect_str) as db_conn:
        c = db_conn.cursor()
        invivo = 1 if vivo == 'invivo' else 0
        c.execute(QUERY_GET_GLYPH_IMAGE_TEMPLATE, (ui_id, glyph_type,
            session, invivo, slice_i))
        if c.rowcount:
            file_path_template = c.fetchone()[0]
            img_path = file_path_template.format(row=row, col=col)
    return _check_image_path(img_path)

def get_glyph_image_preview_path(ui_id, glyph_type, vivo, session, slice_i, row, col):
    img_path = None
    with psycopg2.connect(connect_str) as db_conn:
        c = db_conn.cursor()
        invivo = 1 if vivo == 'invivo' else 0
        c.execute(QUERY_GET_GLYPH_IMAGE_PREVIEW_TEMPLATE, (ui_id,
            glyph_type, session, invivo, slice_i))
        if c.rowcount:
            preview_path_template = c.fetchone()[0]
            img_path = preview_path_template
    return _check_image_path(img_path)

def get_aggregate_mr_image_path(ui_id, proc, axis, slice_i):
    img_path = None
    with psycopg2.connect(connect_str) as db_conn:
        c = db_conn.cursor()
        c.execute(QUERY_GET_AGGREGATE_MR_SLICE_PATH, (ui_id, proc, axis,
            slice_i))
        if c.rowcount:
            img_path = c.fetchone()[0]
    return _check_image_path(img_path)

def get_aggregate_mr_image_preview_path(ui_id, proc, axis, slice_i):
    return get_aggregate_mr_image_path(ui_id, proc, axis, slice_i)
