function ViewerViewClass(context, key, name) {
    this.context = context;
    this.key = key;
    this.name = name;
    this.views = {};
    this.img_url = 'img/webviewer/';
    switch(this.key) {
        case 'block':
            this.img_url += 'red_circle.png';
        break;
        case 'hist':
            this.img_url += 'green_circle.png';
        break;
        case 'accessory-overlay':
            this.img_url += 'yellow_circle.png';
        break;
        case 'mri':
            this.img_url += 'blue_circle.png';
        break;
    }
    this.active = false;
    this.default_views = new Set();
};
ViewerViewClass.prototype.setViews = function(views) {
    for(let view of views) {
        this.views[view.key] = view;
    }
}
ViewerViewClass.prototype.setViewDefault = function(key) {
    this.default_views.add(key);
}
ViewerViewClass.prototype.loadResource = function() {
    for(let key in this.views) {
        let view = this.views[key];
        view.loadResource(this.context.resource);
    }
}
ViewerViewClass.prototype.updateVisibilityFromViews = function() {
    this.active = Object.values(this.views).some((x) => x.active);
	for(let key in this.views) {
        let view = this.views[key];
        view.visible = this.active && !view.empty; //Make view visible if class is enabled
    }
}
ViewerViewClass.prototype.updateVisibility = function() {
    for(let key in this.views) {
        let view = this.views[key];
        view.visible = this.active && !view.empty; //Make view visible if class is enabled
        view.active &= view.visible; //Disable view if view class is disabled
    }
}
ViewerViewClass.prototype.activateDefaultViews = function() {
    if(!this.active) {
        return;
    }
    for(let key of this.default_views) {
        let view = this.views[key];
        view.deactivate();
    }
    if(this.default_views.size) {
        for(let key of this.default_views) {
            let view = this.views[key];
            if(!view.empty) {
                view.activate();
            }
        }
    }
}
ViewerViewClass.prototype.setVivoAndSession = function(vivo, session, volume) {
    for(let key of this.views) {
        let view = this.views[key];
        if(view.modality == 'MR') {
            view.setVivoAndSession(vivo, session, volume);
        }
        else if(view.modality == 'glyph') {
            view.setVivoAndSession(vivo, session);
        }
    }
}
ViewerViewClass.prototype.getLayerImageURL = function() {
    return this.img_url;
}
