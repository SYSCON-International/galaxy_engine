#!/bin/bash

twine upload --skip-existing --repository pypi --config-file .pypirc dist/*
