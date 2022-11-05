# Generated by Django 3.2.15 on 2022-09-14 15:59

import django.db.models.deletion
import fullctl.django.fields.service_bridge
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("django_devicectl", "0014_alter_port_virtual_port"),
    ]

    operations = [
        migrations.AlterField(
            model_name="device",
            name="instance",
            field=models.ForeignKey(
                help_text="deviceCtl environment instance",
                on_delete=django.db.models.deletion.CASCADE,
                related_name="devices",
                to="django_fullctl.instance",
            ),
        ),
        migrations.AlterField(
            model_name="device",
            name="reference",
            field=fullctl.django.fields.service_bridge.ReferencedObjectCharField(
                blank=True,
                bridge_type="device",
                help_text="Remote reference id",
                max_length=255,
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name="facility",
            name="instance",
            field=models.ForeignKey(
                help_text="deviceCtl environment instance",
                on_delete=django.db.models.deletion.CASCADE,
                related_name="facilities",
                to="django_fullctl.instance",
            ),
        ),
        migrations.AlterField(
            model_name="facility",
            name="name",
            field=models.CharField(help_text="Facility name", max_length=255),
        ),
        migrations.AlterField(
            model_name="facility",
            name="reference",
            field=fullctl.django.fields.service_bridge.ReferencedObjectCharField(
                blank=True,
                bridge_type="facility",
                help_text="Remove reference id",
                max_length=255,
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name="facility",
            name="slug",
            field=models.SlugField(help_text="Unique url-friendly slug", max_length=64),
        ),
        migrations.AlterField(
            model_name="physicalport",
            name="logical_port",
            field=models.ForeignKey(
                help_text="Logical port this physical port is a member of",
                on_delete=django.db.models.deletion.CASCADE,
                related_name="physical_ports",
                to="django_devicectl.logicalport",
            ),
        ),
    ]
