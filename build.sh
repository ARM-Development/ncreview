#!/bin/bash

script_name=$0

# Print usage

usage()
{
    cat <<EOM

DESCRIPTION

  Build script used to install this package.

SYNOPSIS

  $script_name [--prefix=path] [--destdir=path]

OPTIONS

  --prefix=path     absolute path to the installation directory
                    default: \$DSUTIL_HOME

  --destdir=path    absolute path to prepended to the prefix,
                    used to perform a staged installation

  --uninstall       uninstall all package files

  --py              build Python package only

  --web             build web app only

  --apr             build for APR packaging

  -h, --help        display this help message

EOM
}

# Parse command line

for i in "$@"
do
    case $i in
        --destdir=*)      destdir="${i#*=}"
                          ;;
        --prefix=*)       prefix="${i#*=}"
                          ;;
        --pyprefix=*)     pyprefix="${i#*=}"
                          ;;
        --uninstall)      uninstall=1
                          ;;
        --py)             pyonly=1
                          ;;
        --web)            webonly=1
                          ;;
        --apr)            apr=1
                          ;;
        -h | --help)      usage
                          exit 0
                          ;;
        *)                usage
                          exit 1
                          ;;
    esac
done

if [ $destdir ] && [ ! $prefix ]; then
   usage
   exit 1
fi

# Get prefix from environemnt variables if necessary

if [ ! $prefix ]; then
    if [ $DSUTIL_HOME ]; then
        prefix=$DSUTIL_HOME
    else
        usage
        exit 1
    fi
fi

# Get version from BUILD_PACKAGE_VERSION environment variable
# if it exists, otherwise get it from the git tag

version=$BUILD_PACKAGE_VERSION

if [ -z "$version" ]; then

    tag=`git describe --tags 2>/dev/null`

    if [ -z "$tag" ]; then
        version="0.0-0"

    else
        version=`echo $tag | \
                 sed -E "s/.*v([0-9]+)\.([0-9]+)\.([0-9]+.*)$/\1.\2-\3/"`
    fi
fi

echo "----------------------------------------------------------------------"

if [ $destdir ]; then
    echo "destdir: $destdir"
fi

echo "prefix:  $prefix"
echo "version: $version"

# Function to echo and run commands

run() {
    echo "> $1"
    $1 || exit 1
}

if [ -d web ] && [ ! $pyonly ]; then

    echo "------------------------------------------------------------------"
    confdir="$destdir$prefix/conf"
    webdir="$destdir$prefix/www"
    echo "webdir:  $webdir"

    cd web
    if [ $uninstall ]; then
        run "rm -rf $confdir"
        run "rm -rf $webdir"

        echo "uninstalled: $confdir"
        echo "uninstalled: $webdir"
    else
        confdir="$confdir/httpd"
        webdir="$webdir/Root/dsutil/ncreview"
        npm=/apps/base/bin/npm

        PUBLIC_URL="/ncreview"
        if [ ! $apr ]; then
            PUBLIC_URL="/~$USER$PUBLIC_URL"
        fi
        export PUBLIC_URL
        export REACT_APP_URL_PREFIX=$PUBLIC_URL

        run "$npm ci"
        run "$npm run build"

        run "mkdir -p $confdir"
        run "mkdir -p $webdir"

        run "cp -R build/* $webdir"
        run "cp ncreview.conf $confdir"

        echo "installed: $confdir"
        echo "installed: $webdir"

        if [ ! $apr ] && [ -d "$HOME/www" ]; then

            link="$HOME/www/ncreview"
            if [ -d $link ]; then
                run "rm -rf $link"
            elif [ -e $link ]; then
                run "rm $link"
            fi

            run "ln -s $webdir $link"

            echo "linked: $link -> $webdir"
        fi
    fi
    cd ..

    if [ -d web-legacy ]; then

        echo "------------------------------------------------------------------"
        webdir="$webdir/legacy"
        echo "webdir:  $webdir"

        cd web-legacy
        if [ $uninstall ]; then
            run "rm -rf $webdir"

            echo "uninstalled: $webdir"
        else
            run "mkdir -p $webdir"

            run "cp -R * $webdir"

            echo "installed: $webdir"
        fi
        cd ..
    fi
fi

if [ $webonly ]; then
    exit 0
fi

echo "------------------------------------------------------------------"

bins=("ncreview" "ncrplot")
package=ncrpy
rootdir="$destdir$prefix"
bindir="$rootdir/bin"
appdir="$rootdir/lib/$package"
python_version=3.9
pip="/apps/base/python$python_version/bin/pip"

if [ ! -d $bindir ]; then
    run "mkdir -p $bindir"
fi

for bin in ${bins[@]}; do
    run "rm -f $bindir/$bin"
done

if [ ! -d $appdir ]; then
    run "mkdir -p $appdir"
fi

run "rm -rf $appdir/*"

if [ $uninstall ]; then
    run "rm -rf $appdir"
    exit 0
fi

run "cp requirements.txt $appdir"

run "$pip install .\
    --no-deps \
    --no-warn-script-location \
    --prefix=$appdir"

cat >$appdir/install.sh <<EOM
#!/bin/sh
here=\$(dirname "\$(readlink -f "\$0")")
$pip install \\
    -r \$here/requirements.txt \\
    --prefer-binary \\
    --no-warn-script-location \\
    --ignore-installed \\
    --prefix=\$here
EOM
run "chmod 744 $appdir/install.sh"

for bin in ${bins[@]}; do

    cat >$bindir/$bin <<EOM
#!/bin/sh
here=\$(dirname "\$(readlink -f "\$0")")
lib="\$here/../lib/${package}"
bin="\$lib/bin/${bin}"
export PYTHONPATH="\$lib/lib/python${python_version}/site-packages"
\$bin \$@
exit $?
EOM
    run "chmod +x $bindir/$bin"

done

if [ -f .env ]; then
    cp .env $appdir
fi

if [ ! $apr ]; then
    run "$appdir/install.sh"
fi

echo "DEV ALTERNATIVE: pip install --user -e ."
exit 0
