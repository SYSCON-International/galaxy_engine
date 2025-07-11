# views.py

from django.shortcuts import render
from django.http import Http404

def doc_section(request, section):
    section = section.lower()
    template_path = f'documentation_app/partials/{section}.html'

    try:
        return render(request, template_path)
    except Exception:
        raise Http404(f"Section '{section}' not found.")
