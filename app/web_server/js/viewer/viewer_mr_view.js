
function ViewerMRPanel(view, canvas) {
    ViewerSingleImagePanel.call(this, view, canvas);
};
ViewerMRPanel.prototype = Object.create(ViewerSingleImagePanel.prototype);
ViewerMRPanel.prototype.buildTemplateURL = function(url_start,
        slice_index) {
    return [url_start, 'MR', this.view.submodality, this.view.vivo, String(this.view.session)]
        .concat(this.view.volume ? [this.view.volume] : [])
        .concat([this.canvas.axis, String(slice_index)])
        .join('/');
};
ViewerMRPanel.prototype.buildPreviewTemplateURL = function(url_start,
        slice_index) {
    return [url_start, 'MR', this.view.submodality, this.view.vivo, String(this.view.session)]
        .concat(this.view.volume ? [this.view.volume] : [])
        .concat([this.canvas.axis, String(slice_index), 'preview'])
        .join('/');
};

function MRView(context, view_class, submodality, name) {
	View.call(this, context, view_class, 'MR', submodality, name, {
        'coronal': new ViewerMRPanel(this, context.canvas.coronal),
        'axial': new ViewerMRPanel(this, context.canvas.axial),
        'sagittal': new ViewerMRPanel(this, context.canvas.sagittal),
    });
}
MRView.prototype = Object.create(View.prototype);
MRView.prototype.loadResource = function(resource) {
    this.resetSlices();
	let view_params = this.context.view_params;
    this.empty = !('MR' in resource.modes) || !resource.modes.MR ? 1 :
        !(this.submodality in resource.modes.MR) || !resource.modes.MR[this.submodality] ? 1
        : 0;
    let info = this.empty ? {} : resource.modes.MR[this.submodality];
    this.has_volumes = info.has_volumes;
    this.volume_name = this.has_volumes ? this.submodality + '_vol' : null;
    this.volume = this.has_volumes ? view_params[this.volume_name] : '';
    this.volumes = null;
    this.sessions = Object.assign({}, info.sessions);
    this.session_names = info.session_names ? info.session_names.slice() : [];
    if(this.context.session_names.length == 0) {
        for(let session_name of this.session_names)  {
            this.context.session_names.push(session_name);
        }
    }
    this.empty |= this.session_names.length == 0;
    //Options
    this.layer_opt = {
        'sessions': this.session_names,
    };
    if(this.has_volumes) {
        this.volumes = new Set();
        for(let sess_num in this.sessions) {
            let sess_info = this.sessions[sess_num];
            for(let vivo in sess_info) {
                let vivo_info = sess_info[vivo];
                for(let volume in vivo_info) {
                    this.volumes.add(volume);
                }
            }
        }
        this.layer_opt.volumes = Array.from(this.volumes);
    }
    //Properties
    this.setVivoAndSession(view_params.vivo, view_params.session, this.volume,
        {'update_bounds': false});
}
MRView.prototype.setSessionName = function(session_name, volume, options) {
    if(volume === null) {
        volume = this.volume;
    }
    if(session_name.indexOf('-') != -1) {
        let [vivo, session] = session_name.split('-', 2);
        return this.setVivoAndSession(vivo, session, volume, options);
    }
    return this.context.view_params;
}
MRView.prototype.setVivoAndSession = function(vivo, session, volume, options) {
	let context = this.context;
    let view_params = context.view_params;
    //console.log('attempt to call setSession(' + session + ') and setVivo(' +
    //    vivo + ') and setVolume(' + volume + ')');
    if((session in this.sessions) && (vivo in this.sessions[session])
            && (!this.has_volumes || volume in this.sessions[session][vivo])) {
        //console.log('calling setSession(' + session + ') and setVivo(' +
        //    vivo + ') and setVolume(' + volume + ')');
        this.session_name = vivo + '-' + session;
        this.session = session;
        this.vivo = vivo;
        this.volume = !this.has_volumes ? null : volume;
        let sess_info = this.sessions[this.session][this.vivo];
        if(this.has_volumes) {
            sess_info = sess_info[this.volume];
            view_params[this.volume_name] = volume;
            context.setScopeVariable(this.volume_name, this.volume);
        }
        for(let axis in this.panels) {
            let panel = this.panels[axis];
            if(!panel) continue;
            let axis_info = sess_info[axis] || {};
	        panel.min_slice = axis_info.min_slice || null;
	        panel.max_slice = axis_info.max_slice || null;
            panel.setImageDimensions(axis_info.image_w || null,
                axis_info.image_h || null);
	        panel.slice_holes = new Set();
            panel.attrib = this._createPanelAttrib(axis_info.attrib);
            if(!options || options.update_bounds) {
                context.checkSliceBounds(axis);
            }
		}
		this.resetSlices();
    }
    return view_params;
};
