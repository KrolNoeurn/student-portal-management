import django_filters

from apps.students.models import Student


class StudentFilter(django_filters.FilterSet):
    dob_from = django_filters.DateFilter(field_name="date_of_birth", lookup_expr="gte")
    dob_to = django_filters.DateFilter(field_name="date_of_birth", lookup_expr="lte")

    class Meta:
        model = Student
        fields = [
            "status",
            "gender",
            "registration_state",
            "nationality",
            "province",
            "dob_from",
            "dob_to",
        ]
