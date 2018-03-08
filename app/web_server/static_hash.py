"""
    static_hash.py
    Calculate the hash of a javascript/css/image file
"""
import hashlib
import imghdr
import os


def get_hash_key(filename, folder, prefix=None):
    fn = os.path.join(folder, filename)
    if not os.path.isfile(fn):
        return ''
    path = os.path.relpath(fn, folder)
    if not prefix:
        if filename.endswith('.js'):
            prefix = 'js'
        elif filename.endswith('.css'):
            prefix = 'css'
        elif imghdr.what(filename):
            prefix = 'img'
    if prefix not in ['js', 'css', 'img']:
        return ''
    return '{0}[{1}]'.format(prefix, path)

def get_hash(filename, folder):
    fn = os.path.join(folder, filename)
    if not os.path.isfile(fn):
        return None
    md5 = hashlib.md5()
    with open(fn, 'rb') as f:
        for chunk in iter(lambda: f.read(4096), b''):
            md5.update(chunk)
    digest = md5.hexdigest()
    return digest
