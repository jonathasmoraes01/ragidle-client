#version 300 es
precision highp float;

// RAGIDLE (06/10/2026, D-2048): a PRIMEIRA reserva do sprite. E o principal
// (`SpriteRenderer.vs`) SEM o bloco de correcao de profundidade por vertice -
// o raio-plano com `uViewModelMat`, os `normalize`, a divisao e o `min` em z,
// que so o sprite tem entre os shaders do jogo. Sem ela o sprite volta ao
// billboard classico do roBrowser: a perna pode entrar um pouco no chao em
// rampa. O `uDisableDepthCorrection` e o `uViewModelMat` nao existem aqui; o
// `SpriteRenderer.js` manda os dois mesmo assim, e o WebGL ignora uniform sem
// local (a chamada com `null` nao faz nada).

in vec2 aPosition;
in vec2 aTextureCoord;

out vec2 vTextureCoord;

uniform mat4 uModelViewMat;
uniform mat4 uProjectionMat;

uniform float uCameraZoom;

uniform vec2 uSpriteRendererSize;
uniform vec2 uSpriteRendererOffset;
uniform mat4 uSpriteRendererAngle;
uniform vec3 uSpriteRendererPosition;
uniform float uSpriteRendererDepth;
uniform float uSpriteRendererZindex;

mat4 Project( mat4 mat, vec3 pos) {

    // xyz = x(-z)y + middle of cell (0.5)
    float x =  pos.x + 0.5;
    float y = -pos.z;
    float z =  pos.y + 0.5;

    // Matrix translation
    mat[3].x += mat[0].x * x + mat[1].x * y + mat[2].x * z;
    mat[3].y += mat[0].y * x + mat[1].y * y + mat[2].y * z;
    mat[3].z += (mat[0].z * x + mat[1].z * y + mat[2].z * z);
    mat[3].w += mat[0].w * x + mat[1].w * y + mat[2].w * z;

    // Spherical billboard
    mat[0].xyz = vec3( 1.0, 0.0, 0.0 );
    mat[1].xyz = vec3( 0.0, 1.0, 0.0 );
    mat[2].xyz = vec3( 0.0, 0.0, 1.0 );

    return mat;
}

void main(void) {
    vec4 position = uSpriteRendererAngle * vec4( aPosition.x * uSpriteRendererSize.x, aPosition.y * uSpriteRendererSize.y, 0.0, 1.0 );
    position.x   += uSpriteRendererOffset.x;
    position.y   -= uSpriteRendererOffset.y + 0.5;

    mat4 modelView = Project(uModelViewMat, uSpriteRendererPosition);
    vec4 clip = uProjectionMat * (modelView * position);
    clip.z -= (uSpriteRendererZindex * 0.01 + uSpriteRendererDepth) / max(uCameraZoom, 1.0);

    gl_Position   = clip;
    vTextureCoord = aTextureCoord;
}
