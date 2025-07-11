from django.urls import path, re_path
from django.views.generic import TemplateView
from documentation_app.views import doc_section_view

urlpatterns = (
    re_path(r'^$', TemplateView.as_view(template_name='galaxy_engine/../documentation_app/templates/documentation_app/index.html'), name='index'),
    path('docs/<str:section>/', doc_section_view.doc_section, name='doc_section'),
)
