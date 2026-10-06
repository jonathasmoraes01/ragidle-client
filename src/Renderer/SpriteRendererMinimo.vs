#version 300 es
precision highp float;

// RAGIDLE (06/10/2026, D-2048): a ULTIMA reserva do sprite, a mais simples que
// desenha o mesmo billboard. Sem funcao auxiliar, sem matriz recebida como
// parametro e reescrita coluna a coluna (o `Project` dos outros dois), sem
// correcao de profundidade e sem `uniform bool`. A conta do `Project` vira um
// produto matriz-vetor: para a modelView afim da camera (a quarta linha e
// 0,0,0,1) o centro do sprite na vista e `uModelViewMat * vec4(celula, 1)`, e
// o billboard soma o deslocamento do quad direto em x/y/z da vista.

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

void main(void) {
    vec4 position = uSpriteRendererAngle * vec4( aPosition.x * uSpriteRendererSize.x, aPosition.y * uSpriteRendererSize.y, 0.0, 1.0 );
    position.x   += uSpriteRendererOffset.x;
    position.y   -= uSpriteRendererOffset.y + 0.5;

    // xyz = x(-z)y + meio da celula (0.5), como no `Project`
    vec4 celula = vec4( uSpriteRendererPosition.x + 0.5, -uSpriteRendererPosition.z, uSpriteRendererPosition.y + 0.5, 1.0 );
    vec4 centro = uModelViewMat * celula;
    vec4 clip   = uProjectionMat * vec4( centro.xyz + position.xyz, centro.w );
    clip.z     -= (uSpriteRendererZindex * 0.01 + uSpriteRendererDepth) / max(uCameraZoom, 1.0);

    gl_Position   = clip;
    vTextureCoord = aTextureCoord;
}
