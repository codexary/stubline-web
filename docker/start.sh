#!/bin/sh
set -eu
: "${STUBLINE_API_ORIGIN:?Set STUBLINE_API_ORIGIN}"
: "${STUBLINE_TOKEN_ISSUER_ORIGIN:?Set STUBLINE_TOKEN_ISSUER_ORIGIN}"
case "$STUBLINE_API_ORIGIN:$STUBLINE_TOKEN_ISSUER_ORIGIN" in
  *\'*|*\"*|*\\*|*\;*) echo 'Invalid origin' >&2; exit 1 ;;
esac
case "$STUBLINE_API_ORIGIN" in https://*) ;; *) echo 'API origin must use HTTPS' >&2; exit 1 ;; esac
case "$STUBLINE_TOKEN_ISSUER_ORIGIN" in https://*) ;; *) echo 'Issuer origin must use HTTPS' >&2; exit 1 ;; esac
envsubst '${STUBLINE_API_ORIGIN} ${STUBLINE_TOKEN_ISSUER_ORIGIN}' < /opt/stubline/config.json.template > /tmp/config.json
envsubst '${STUBLINE_API_ORIGIN} ${STUBLINE_TOKEN_ISSUER_ORIGIN}' < /etc/nginx/templates/default.conf.template > /tmp/nginx.conf
exec nginx -c /tmp/nginx.conf -g 'daemon off;'
