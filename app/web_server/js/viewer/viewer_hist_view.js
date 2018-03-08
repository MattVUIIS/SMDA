let ViewHistPanel = function ViewerHistPanel(view, canvas) {
    ViewerMosaicPanel.call(this, view, canvas);
}
ViewHistPanel.prototype = Object.create(ViewerMosaicPanel.prototype);
ViewHistPanel.prototype.buildTemplateURL = function(url_start,
        slice_index) {
    return [url_start, this.view.modality, this.view.stain,
        String(slice_index)].join('/');
}
ViewHistPanel.prototype.buildPreviewTemplateURL = function(url_start,
        slice_index) {
    return [url_start, this.view.modality, this.view.stain, String(slice_index),
        String(this.view.context.level), 'preview'].join('/');
}
ViewHistPanel.prototype.buildMosaicTemplateURL = function(url_start,
        slice_index, row, col) {
    return [url_start, String(this.view.context.level), String(row),
        String(col)].join('/');
}

function HistView(context, view_class) {
	View.call(this, context, view_class, 'hist', '', 'Histology', {
        'coronal': new ViewHistPanel(this, context.canvas.coronal),
    });
}
HistView.prototype = Object.create(View.prototype);
HistView.prototype.loadResource = function(resource) {
	let view_params = this.context.view_params;
    this.empty = resource.modes.hist ? 0 : 1;
    let stains = this.empty ? {} : resource.modes.hist;
    this.stains = {};
    this.stain_names = [];
    for(let stain in stains) {
        //Make a copy of the stain information and:
        //1) convert the keys and the level object from string to int
        //2) change the 'hole' lists into Sets
        this.stain_names.push(stain);
        let stain_info = Object.assign({}, stains[stain]);
        stain_info.slice_holes = new Set(stain_info['slice_holes'] || []);
        stain_info.min_level = null;
        stain_info.max_level = null;
        stain_info.levels = {};
        stain_info.attrib = stain_info.attrib || {};
        let orig_level_info = stains[stain].levels;
        for(let level_str in orig_level_info) {
            let level_int = parseInt(level_str, 10);
            let level_info = Object.assign({}, orig_level_info[level_str]);
            level_info.row_holes = level_info['row_holes'] ?
                new Set(level_info['row_holes']) : null;
            level_info.holes = level_info['holes'] ? new Set(
                level_info['holes'].map(function(x) { return x.join(',') }))
                : null;
            stain_info.levels[level_int] = level_info;
            if((stain_info.min_level == null) ||
            (level_int < stain_info.min_level)) {
                stain_info.min_level = level_int;
            }
            if((stain_info.max_level == null) ||
            (level_int > stain_info.max_level)) {
                stain_info.max_level = level_int;
            }
        }
        this.stains[stain] = stain_info;
    }
    this.empty |= this.stain_names.length == 0;
    //Options
    this.layer_opt = {
        'hist_stains': this.stain_names,
    };
    this.panel_opt = {
        'max_visible_area': 100,
    };
    //Properties
    this.setStain(view_params.stain in this.stains ? view_params.stain
        : this.stain_names.length ? this.stain_names[0]
        : null,
        { 'update_bounds': false }
    );
}
HistView.prototype.setStain = function(stain, options) {
    let view_params = this.context.view_params;
    let axis_prefix = this.context.canvas.axis_prefix;
    let stain_info = this.stains[stain] || {};
    let panel = this.panels.coronal;
    //Set stain and slice
    view_params.stain = this.stain = stain;
    this.context.setScopeVariable('stain', this.stain);
    panel.min_slice = stain_info.min_slice || null;
    panel.max_slice = stain_info.max_slice || null;
    panel.setImageDimensions(stain_info.image_w || null,
        stain_info.image_h || null);
    this.mag_factor = stain_info.mag_factor || 4;
    panel.slice = Math.max(panel.min_slice, Math.min(panel.max_slice,
        panel.slice || Math.floor((panel.min_slice + panel.max_slice) / 2)));
    this.context.setScopeVariable(axis_prefix + 'slice', panel.slice);
    //Get the min and max levels
    this.min_level = stain_info.min_level || 2;
    this.max_level = stain_info.max_level || 5;
    this.levels = stain_info.levels || {};
    panel.attrib = this._createPanelAttrib(stain_info.attrib);
    if(!options || options.update_bounds) {
        this.context.checkSliceBounds('coronal');
    }
    this.resetSlices();
    return view_params;
};
HistView.prototype.checkPanBounds = function(canvas) {
	let view_params = this.context.view_params;
    let axis_prefix = canvas.axis_prefix;
    let level = this.level = this.context.level;
    let scale = this.scale = this.context.scale;
    let magnification = this.magnification = this.context.magnification;
    //console.log('zoom: ' + zoom);
    let level_info = this.levels[level] || {};
    if(level_info.length === 0) {
        return view_params;
    }
    this.min_row = level_info.min_row;
    this.max_row = level_info.max_row;
    this.min_col = level_info.min_col;
    this.max_col = level_info.max_col;
    this.row_holes = level_info.row_holes;
    this.holes = level_info.holes;
    this.block_image_w = level_info.image_w;
    this.block_image_h = level_info.image_h;
    this.image_w = (this.max_col - this.min_col + 1) * this.block_image_w;
    this.image_h = (this.max_row - this.min_row + 1) * this.block_image_h;
    this.center_row = this.max_row / 2;
    this.center_col = this.max_col / 2;
}
