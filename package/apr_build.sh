#!/bin/sh

prefix=$APR_PREFIX
destdir=$APR_TOPDIR/package

export BUILD_PACKAGE_VERSION="$APR_VERSION"

$APR_TOPDIR/build.sh --prefix=$prefix --destdir=$destdir --apr "$@"
