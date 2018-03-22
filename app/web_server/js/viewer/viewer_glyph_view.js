let ViewGlyphPanel = function ViewGlyphPanel(view, canvas) {
    ViewerMosaicPanel.call(this, view, canvas);
}
ViewGlyphPanel.prototype = Object.create(ViewerMosaicPanel.prototype);
ViewGlyphPanel.prototype.buildTemplateURL = function(url_start,
        slice_index) {
    return [url_start, this.view.modality, this.view.submodality, this.view.vivo,
    	String(this.view.session), String(slice_index)].join('/');
}
ViewGlyphPanel.prototype.buildPreviewTemplateURL = function(url_start,
        slice_index) {
    return [url_start, this.view.modality, this.view.submodality, this.view.vivo,
    	String(this.view.session), String(slice_index), 'preview'].join('/');
}
ViewGlyphPanel.prototype.buildMosaicTemplateURL = function(url_start,
        slice_index, row, col) {
    return [url_start, String(row), String(col)].join('/');
}

function GlyphView(context, id, view_class, submodality, name) {
	View.call(this, context, id, view_class, 'glyph', submodality, name, {
		'coronal': new ViewGlyphPanel(this, context.canvas.coronal),
	});
}
GlyphView.prototype = Object.create(View.prototype);
GlyphView.prototype.loadResource = function(resource) {
	this.resetSlices();
	let view_params = this.context.view_params;
	this.empty = !('glyphs' in resource.modes) || !resource.modes.glyphs ? 1 :
        !(this.submodality in resource.modes.glyphs) || !resource.modes.glyphs[this.submodality] ? 1
        : 0;
    let glyphs = this.empty ? {} : resource.modes.glyphs[this.submodality];
    let panel = this.panels.coronal;
    this.sessions = Object.assign({}, glyphs.sessions || {});
    this.session_names = kvMap(this.sessions,
    	(sess_num, sess) => (
    		kvMap(sess, (vivo, axis_d) => (vivo + '-' + sess_num))
    )).reduce((s, v) => s.concat(v), []);
    if(this.context.session_names.length == 0) {
        for(let session_name of this.session_names)  {
            this.context.session_names.push(session_name);
        }
    }
    //Options
    this.layer_opt = {
    	'sessions': this.session_names,
    };
    this.panel_opt = {
        'max_visible_area': 4096,
    };
    //Properties
    this.setVivoAndSession(view_params.vivo, view_params.session,
        {'update_bounds': false});
}
GlyphView.prototype.setSessionName = function(session_name, options) {
    if(session_name.indexOf('-') != -1) {
        let [vivo, session] = session_name.split('-', 2);
        return this.setVivoAndSession(vivo, session, options);
    }
    return this.context.view_params;
}
GlyphView.prototype.setVivoAndSession = function(vivo, session, options) {
	let context = this.context;
    let view_params = context.view_params;
    if((session in this.sessions) && (vivo in this.sessions[session])) {
        this.session_name = vivo + '-' + session;
        this.session = session;
        this.vivo = vivo;
    	let sess_info = this.sessions[this.session][this.vivo];
    	let panel = this.panels.coronal;
        panel.min_slice = sess_info.min_slice || null;
	    panel.max_slice = sess_info.max_slice || null;
        panel.setImageDimensions(sess_info.image_w || null,
            sess_info.image_h || null);
	    panel.slice_holes = new Set();
	    this.min_row = sess_info.min_row || 0;
	    this.max_row = sess_info.max_row || 0;
	    this.min_col = sess_info.min_col || 0;
	    this.max_col = sess_info.max_col || 0;
	    this.center_row = this.max_row / 2;
	    this.center_col = this.max_col / 2;
	    this.image_w = sess_info.image_w || 1;
	    this.image_h = sess_info.image_h || 1;
	    panel.attrib = this._createPanelAttrib(sess_info.attrib);
        //console.log('call by glyph view ' + this.name);
        if(!options || options.update_bounds) {
            context.checkSliceBounds('coronal');
        }
		this.resetSlices();
    }
    return view_params;
};
