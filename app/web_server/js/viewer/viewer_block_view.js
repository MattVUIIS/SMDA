function ViewerBlockPanel(view, canvas) {
    ViewerSingleImagePanel.call(this, view, canvas);
};
ViewerBlockPanel.prototype = Object.create(ViewerSingleImagePanel.prototype);
ViewerBlockPanel.prototype.buildTemplateURL = function(url_start,
        slice_index) {
    return [url_start, this.view.modality, String(slice_index)].join('/');
};
ViewerBlockPanel.prototype.buildPreviewTemplateURL = function(url_start,
        slice_index) {
    return [url_start, this.view.modality, String(slice_index),
        'preview'].join('/');
};

function BlockView(context, view_class) {
	View.call(this, context, view_class, 'block', '', 'Block', {
        'coronal': new ViewerBlockPanel(this, context.canvas.coronal),
    });
}
BlockView.prototype = Object.create(View.prototype);
BlockView.prototype.loadResource = function(resource) {
	let block_info = resource.modes.block || {};
    let panel = this.panels.coronal;
    this.empty = resource.modes.block ? 0 : 1;
    panel.min_slice = block_info.min_slice || null;
    panel.max_slice = block_info.max_slice || null;
    panel.setImageDimensions(block_info.image_w || 1,
        block_info.image_h || 1);
    panel.slice_holes = new Set(block_info['slice_holes'] || []);
    this.image_w = block_info.image_w || 1;
    this.image_h = block_info.image_h || 1;
    panel.attrib = this._createPanelAttrib(block_info.attrib);
    this.resetSlices();
}
