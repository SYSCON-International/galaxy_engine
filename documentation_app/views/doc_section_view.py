# views.py

from pathlib import Path

from django.http import Http404
from django.shortcuts import render
from django.template import TemplateDoesNotExist

PARTIALS_DIR = Path(__file__).resolve().parent.parent / "templates" / "documentation_app" / "partials"


def get_available_sections():
    """
    The set of valid section names -- one per `partials/<section>.html` file. Shared with
    documentation_app/tests.py, which checks these stay in sync with navigation.html's links.
    """
    return {path.stem for path in PARTIALS_DIR.glob("*.html")}


def doc_section(request, section):
    section = section.lower()

    if section not in get_available_sections():
        raise Http404(f"Section '{section}' not found.")

    template_path = f"documentation_app/partials/{section}.html"

    try:
        return render(request, template_path)
    except TemplateDoesNotExist:
        raise Http404(f"Section '{section}' not found.")
