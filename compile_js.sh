#!/bin/bash -x
java -jar closure-compiler-v20170910.jar --language_in ES6 --js \
app/web_server/js/viewer/viewer_shader.js \
app/web_server/js/viewer/viewer_canvas.js \
app/web_server/js/viewer/viewer_image.js \
app/web_server/js/viewer/viewer_panel.js \
app/web_server/js/viewer/viewer_single_image_panel.js \
app/web_server/js/viewer/viewer_mosaic_panel.js \
app/web_server/js/viewer/viewer_view.js \
app/web_server/js/viewer/viewer_block_view.js \
app/web_server/js/viewer/viewer_hist_view.js \
app/web_server/js/viewer/viewer_mr_view.js \
app/web_server/js/viewer/viewer_label_view.js \
app/web_server/js/viewer/viewer_glyph_view.js \
app/web_server/js/viewer/viewer_aggregate_mr_view.js \
app/web_server/js/viewer/viewer_toolset.js \
app/web_server/js/viewer/viewer_context.js \
app/web_server/js/viewer_module.js \
--js_output_file root/srv/smda/js/viewer.min.js

