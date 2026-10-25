#!/bin/sh
# Deletes the local cluster, and with it everything in it (the database too).
set -eu
kind delete cluster --name sales
