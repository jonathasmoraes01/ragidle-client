#version 300 es
precision highp float;

// RAGIDLE (06/10/2026, D-2048): o fragment da ULTIMA reserva do sprite. Igual
// ao `SpriteRenderer.fs`, menos a suavizacao bilinear da paleta: aqui a paleta
// e lida com UMA amostra do indice (o pixel do sprite fica mais duro nas
// bordas), sem funcao que recebe `sampler2D` como parametro - a forma que mais
// varia entre compiladores de celular. Os uniforms `uTextSize` e `uIsRGBA`
// somem; o `SpriteRenderer.js` os manda mesmo assim, sem efeito.

in vec2 vTextureCoord;
out vec4 fragColor;

uniform sampler2D uDiffuse;
uniform sampler2D uPalette;

uniform bool uUsePal;
uniform vec4 uSpriteRendererColor;

uniform bool  uFogUse;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3  uFogColor;

uniform float uShadow;

void main(void) {
    if (uSpriteRendererColor.a == 0.0) {
        discard;
    }

    vec4 textureSample;
    if (uUsePal) {
        float indice = texture( uDiffuse, vTextureCoord.st ).x;
        if (indice == 0.0) {
            discard;
        }
        textureSample = vec4( texture( uPalette, vec2( indice, 1.0 ) ).rgb, 1.0 );
    }
    else {
        textureSample = texture( uDiffuse, vTextureCoord.st );
    }

    if (textureSample.a == 0.0) {
        discard;
    }

    textureSample.rgb *= uShadow;
    fragColor = textureSample * uSpriteRendererColor;

    if (uFogUse) {
        float depth     = gl_FragCoord.z / gl_FragCoord.w;
        float fogFactor = smoothstep( uFogNear, uFogFar, depth );
        fragColor       = mix( fragColor, vec4( uFogColor, fragColor.w ), fogFactor );
    }
}
