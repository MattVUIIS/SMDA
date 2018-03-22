function LabelView(context, id, view_class, submodality, name) {
    View.call(this, context, id, view_class, 'label', submodality, name, {
        'coronal': new ViewerLabelPanel(this, context.canvas.coronal),
        'axial': new ViewerLabelPanel(this, context.canvas.axial),
        'sagittal': new ViewerLabelPanel(this, context.canvas.sagittal),
    });
}
LabelView.prototype = Object.create(View.prototype);
LabelView.prototype.loadResource = function(resource) {
    let view_params = this.context.view_params;
    this.empty = !('labels' in resource.modes) || !resource.modes.labels ? 1 :
        !(this.submodality in resource.modes.labels) || !resource.modes.labels[this.submodality] ? 1
        : 0;
    let label_info = this.empty ? {} : resource.modes.labels[this.submodality];
    for(let axis in this.panels) {
        let panel = this.panels[axis];
        if(!panel) continue;
        let axis_info = label_info[axis] || {};
        panel.min_slice = axis_info.min_slice || null;
        panel.max_slice = axis_info.max_slice || null;
        panel.setImageDimensions(axis_info.image_w || null,
            axis_info.image_h || null);
        panel.slice_holes = new Set();
        panel.attrib = this._createPanelAttrib(axis_info.attrib);
        panel.setUseMousePoint(this.submodality == 'MR' || this.submodality == 'roi');
    }
    this.resetSlices();
}
