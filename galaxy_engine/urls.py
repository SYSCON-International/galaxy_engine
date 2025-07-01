from django.conf.urls.i18n import i18n_patterns
from django.urls import re_path
from django.views.generic.base import TemplateView

urlpatterns = i18n_patterns(
    re_path(r'^$', TemplateView.as_view(template_name='index.html'), name='index'),
)