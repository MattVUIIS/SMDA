function ViewerAMRPanel(view, canvas) {
    ViewerSingleImagePanel.call(this, view, canvas);
};
ViewerAMRPanel.prototype = Object.create(ViewerSingleImagePanel.prototype);
ViewerAMRPanel.prototype.buildTemplateURL = function(url_start,
        slice_index) {
    return [url_start, 'aMR', this.view.submodality]
        .concat(this.view.volume ? [this.view.volume] : [])
        .concat([this.canvas.axis, String(slice_index)])
        .join('/');
};
ViewerAMRPanel.prototype.buildPreviewTemplateURL = function(url_start,
        slice_index) {
    return [url_start, 'aMR', this.view.submodality]
        .concat(this.view.volume ? [this.view.volume] : [])
        .concat([this.canvas.axis, String(slice_index), 'preview'])
        .join('/');
};

function AggregateMRView(context, view_class, submodality, name) {
	View.call(this, context, view_class, 'aggregateMR', submodality, name, {
        'coronal': new ViewerAMRPanel(this, context.canvas.coronal),
        'axial': new ViewerAMRPanel(this, context.canvas.axial),
        'sagittal': new ViewerAMRPanel(this, context.canvas.sagittal),
    });
}
AggregateMRView.prototype = Object.create(View.prototype);
AggregateMRView.prototype.loadResource = function(resource) {
    this.resetSlices();
	let view_params = this.context.view_params;
    this.empty = !('aggregateMR' in resource.modes) || !resource.modes.aggregateMR ? 1 :
        !(this.submodality in resource.modes.aggregateMR) || !resource.modes.aggregateMR[this.submodality] ? 1
        : 0;
    let info = this.empty ? {} : resource.modes.aggregateMR[this.submodality];
    this.has_volumes = info.has_volumes;
    this.volume_name = this.has_volumes ? this.submodality + '_vol' : null;
    this.volume = this.has_volumes ? view_params[this.volume_name] : '';
    //console.log(this.submodality + ' info: ' + JSON.stringify(info));
    let all_sessions = info.all_sessions || {};
    for(let axis in this.panels) {
        let panel = this.panels[axis];
        if(!panel) continue;
        let axis_info = all_sessions[axis] || {};
        panel.min_slice = axis_info.min_slice || null;
        panel.max_slice = axis_info.max_slice || null;
        panel.setImageDimensions(axis_info.image_w || null,
            axis_info.image_h || null);
        panel.slice_holes = new Set();
        panel.attrib = this._createPanelAttrib(axis_info.attrib);
        if(panel.attrib && ('thickness_in_mm' in panel.attrib)) {
            this.context.has_thickness = true;
            this.context.thickness[axis] = panel.attrib.thickness_in_mm;
        }
    }
    this.resetSlices();
}
