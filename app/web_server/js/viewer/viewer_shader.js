/*
    Encapsulates a WebGL Shader
*/
function ViewerShader(gl) {
    this.gl = gl;
    this.program = null;
    this.attrib = null;
    this.uniform = null;
}
ViewerShader.prototype.initialize = function(options) {
    let vertexShaders = options['vertex'] || [];
    let fragmentShaders = options['fragment'] || [];
    let gl = this.gl;
    this.program = gl.createProgram();
    for(let i = vertexShaders.length - 1; i >= 0; i--) {
        let shader = this.compileShader(vertexShaders[i]);
        if(!shader) return false; //Exit if error
        gl.attachShader(this.program, shader);
    }
    for(let i = fragmentShaders.length - 1; i >= 0; i--) {
        let shader = this.compileShader(fragmentShaders[i]);
        if(!shader) return false; //Exit if error
        gl.attachShader(this.program, shader);
    }
    gl.linkProgram(this.program);
    if(!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
        let info = gl.getProgramInfoLog(this.program);
        alert("Could not initialize shaders: " + info);
        return false;
    }
    //Iterate down to 0 so we only have to read ACTIVE_ATTRIBUTES once
    this.attrib = {};
    for(let i = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES) - 1;
        i >= 0; i--) {
        let name = gl.getActiveAttrib(this.program, i).name;
        //console.log("Got attrib name '" + name + "'");
        this.attrib[name] = gl.getAttribLocation(this.program, name);
    }
    this.uniform = {};
    for(let i = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS) - 1;
        i >= 0; i--) {
        let name = gl.getActiveUniform(this.program, i).name;
        //console.log("Got uniform name '" + name + "'");
        this.uniform[name] = gl.getUniformLocation(this.program, name);
    }
    return true;
};
ViewerShader.prototype.compileShader = function(id) {
    let gl = this.gl;
    let shaderScript = document.getElementById(id);
    if (!shaderScript) {
        console.log('failed to find "' + id + '" element');
        return null;
    }
    let src = "";
    let k = shaderScript.firstChild;
    while (k) {
        if (k.nodeType == Node.TEXT_NODE) {
            src += k.textContent;
        }
        k = k.nextSibling;
    }
    let shader = null;
    if (shaderScript.type == "x-shader/x-fragment") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    }
    else if (shaderScript.type == "x-shader/x-vertex") {
        shader = gl.createShader(gl.VERTEX_SHADER);
    }
    else {
        console.log("no valid shader type found for " + id);
        return null;
    }
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        let info = gl.getShaderInfoLog(shader)
        console.log("Shader type: " + shaderScript.type + " error: " + info + " source " + src);
        alert("Failed to compile shader: " + info);
        return null;
    }
    return shader;
};
