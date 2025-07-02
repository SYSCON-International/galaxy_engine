from django.urls import path, re_path
from django.views.generic import TemplateView
from galaxy_engine.views import doc_section_view

urlpatterns = (
    re_path(r'^$', TemplateView.as_view(template_name='galaxy_engine/index.html'), name='index'),
    path('docs/<str:section>/', doc_section_view.doc_section, name='doc_section'),
)
