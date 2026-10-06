#version 300 es
precision highp float;

// RAGIDLE (06/10/2026, D-2054): VARIANTE DE DIAGNOSTICO `sem-funcao`
// (`?forcarSpriteReserva=3`). E o `SpriteRenderer.vs` principal com UMA peca
// trocada: a funcao `Project`, que recebe uma `mat4` e reescreve as colunas
// dela, sai; a mesma conta e feita em linha no `main`, em forma vetorial. A
// correcao de profundidade e o `uniform bool` ficam. Se os sprites voltarem
// com ela no PowerVR, o defeito e a funcao com a matriz como parametro.

in vec2 aPosition;
in vec2 aTextureCoord;

out vec2 vTextureCoord;

uniform mat4 uModelViewMat;
uniform mat4 uViewModelMat;
uniform mat4 uProjectionMat;

uniform float uCameraZoom;
uniform float uCameraLatitude;

uniform vec2 uSpriteRendererSize;
uniform vec2 uSpriteRendererOffset;
uniform mat4 uSpriteRendererAngle;
uniform vec3 uSpriteRendererPosition;
uniform float uSpriteRendererDepth;
uniform float uSpriteRendererZindex;
uniform bool  uDisableDepthCorrection;

vec3 getCameraPosition() {
    return (uViewModelMat * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
}

vec3 getCameraForward() {
    return normalize((uViewModelMat * vec4(0.0, 0.0, -1.0, 0.0)).xyz);
}

void main(void) {
    // Calculate position base on angle and sprite offset/size
    vec4 position = uSpriteRendererAngle * vec4( aPosition.x * uSpriteRendererSize.x, aPosition.y * uSpriteRendererSize.y, 0.0, 1.0 );
    position.x   += uSpriteRendererOffset.x;
    position.y   -= uSpriteRendererOffset.y + 0.5;

    // o `Project` em linha: xyz = x(-z)y + meio da celula (0.5)
    vec3 celula = vec3( uSpriteRendererPosition.x + 0.5, -uSpriteRendererPosition.z, uSpriteRendererPosition.y + 0.5 );
    mat4 modelView = uModelViewMat;
    modelView[3] += modelView[0] * celula.x + modelView[1] * celula.y + modelView[2] * celula.z;
    modelView[0].xyz = vec3( 1.0, 0.0, 0.0 );
    modelView[1].xyz = vec3( 0.0, 1.0, 0.0 );
    modelView[2].xyz = vec3( 0.0, 0.0, 1.0 );
    vec4 viewPosition = modelView * position;
    vec4 viewCenter   = modelView * vec4( 0.0, 0.0, 0.0, 1.0 );

    vec4 clip = uProjectionMat * viewPosition;

    vec3 cameraPos     = getCameraPosition();
    vec3 cameraForward = getCameraForward();

    if (!uDisableDepthCorrection) {
        // Vertical billboard depth correction (per-vertex), plane anchored at sprite center.
        // Plane normal uses camera forward (flattened Y) for stability.
        vec3 planePoint = (uViewModelMat * viewCenter).xyz;
        vec3 planeNormal = normalize(vec3(cameraForward.x, 0.0, cameraForward.z));
        if (length(planeNormal) < 0.000001) {
            planeNormal = cameraForward;
        }

        vec3 worldVertex = (uViewModelMat * viewPosition).xyz;
        vec3 rayDir      = normalize(worldVertex - cameraPos);
        float denom      = max(dot(planeNormal, rayDir), 0.000001);
        float dist       = dot(planePoint - cameraPos, planeNormal) / denom;

        vec4 planeClip       = uProjectionMat * (uModelViewMat * vec4(cameraPos + rayDir * dist, 1.0));
        float correctedZBase = planeClip.z * (clip.w / max(planeClip.w, 0.000001));

        clip.z = min(clip.z, correctedZBase);
    }
    clip.z -= (uSpriteRendererZindex * 0.01 + uSpriteRendererDepth) / max(uCameraZoom, 1.0);

    gl_Position   = clip;
    vTextureCoord = aTextureCoord;
}
