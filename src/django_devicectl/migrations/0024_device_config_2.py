# Generated by Django 3.2.15 on 2023-05-11 12:09

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('django_devicectl', '0023_device_dconfig'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='deviceconfighistory',
            name='diff',
        ),
        migrations.RemoveField(
            model_name='deviceoperationalstatus',
            name='diff',
        ),
        migrations.AddField(
            model_name='deviceconfighistory',
            name='config_current',
            field=models.TextField(blank=True, help_text='Current config contents', null=True),
        ),
        migrations.AddField(
            model_name='deviceconfighistory',
            name='config_reference',
            field=models.TextField(blank=True, help_text='Reference config contents', null=True),
        ),
        migrations.AddField(
            model_name='deviceoperationalstatus',
            name='config_current',
            field=models.TextField(blank=True, help_text='Current config contents', null=True),
        ),
        migrations.AddField(
            model_name='deviceoperationalstatus',
            name='config_reference',
            field=models.TextField(blank=True, help_text='Reference config contents', null=True),
        ),
    ]
