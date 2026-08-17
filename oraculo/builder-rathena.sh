#!/bin/sh
# Compila o rAthena de referência (o oráculo do M0).
#
# Por que não usamos o `rathena/tools/docker/builder.sh` do upstream: ele roda
# `make clean server` num ÚNICO make. Com paralelismo (MAKEFLAGS=-j), make
# executa os dois alvos CONCORRENTEMENTE — o `clean` apaga os diretórios `obj/`
# enquanto o `server` já está compilando dentro deles, e o build morre com
# "can't create obj/src/exp.o: No such file or directory". Medido nesta máquina
# em 17/08/2026 com -j10. Com -j2 (o valor do AIO) a corrida às vezes não
# aparece, o que é pior: falha intermitente.
#
# Aqui: clean PRIMEIRO e serial, os obj/ criados DEPOIS dele, e só então o
# server em paralelo.
#
# E o script CONFERE o resultado no fim. O `docker compose up` devolveu exit 0
# com zero binários gerados na primeira tentativa — exit code de compose não é
# prova de build.

set -e
cd /rathena

if [ ! -f /rathena/Makefile ]; then
    echo "=== ./configure $BUILDER_CONFIGURE ==="
    ./configure $BUILDER_CONFIGURE
fi

echo "=== make clean (serial, antes dos mkdir) ==="
make -j1 clean

echo "=== criando os obj/ que o make não cria sozinho ==="
mkdir -p 3rdparty/libconfig/obj
mkdir -p 3rdparty/rapidyaml/obj/src/c4/yml
mkdir -p 3rdparty/rapidyaml/obj/ext/c4core/src/c4
mkdir -p 3rdparty/yaml-cpp/obj/src
mkdir -p 3rdparty/yaml-cpp/obj/src/contrib
mkdir -p 3rdparty/httplib/obj
mkdir -p src/common/obj
mkdir -p src/login/obj
mkdir -p src/char/obj
mkdir -p src/map/obj
mkdir -p src/web/obj
mkdir -p src/tool/obj_all

echo "=== make server (MAKEFLAGS=$MAKEFLAGS) ==="
make server

echo "=== conferindo os binários ==="
faltou=0
for b in login-server char-server map-server; do
    if [ -f "/rathena/$b" ]; then
        echo "  ok   $b"
    else
        echo "  FALTA $b"
        faltou=1
    fi
done

if [ "$faltou" -ne 0 ]; then
    echo "BUILD REPROVADO: binário faltando."
    exit 1
fi

echo "BUILD APROVADO."
