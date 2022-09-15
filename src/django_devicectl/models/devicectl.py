import ipaddress

import reversion
from django.db import models
from django.utils.translation import gettext_lazy as _
from django_grainy.decorators import grainy_model
from fullctl.django.fields.service_bridge import ReferencedObjectCharField
from fullctl.django.inet.fields import DeviceDescriptionField
from fullctl.django.models.abstract import (
    GeoModel,
    HandleRefModel,
    ServiceBridgeReferenceModel,
)
from fullctl.django.models.concrete import Instance
from netfields.fields import InetAddressField


@reversion.register()
@grainy_model(
    namespace="facility",
    namespace_instance="facility.{instance.org.permission_id}.{instance.id}",
)
class Facility(GeoModel, ServiceBridgeReferenceModel):
    instance = models.ForeignKey(
        Instance,
        related_name="facilities",
        on_delete=models.CASCADE,
        help_text=_("deviceCtl environment instance"),
    )

    name = models.CharField(max_length=255, help_text=_("Facility name"))

    reference = ReferencedObjectCharField(
        bridge_type="facility",
        max_length=255,
        null=True,
        blank=True,
        help_text=_("Remove reference id"),
    )
    slug = models.SlugField(
        max_length=64,
        unique=False,
        blank=False,
        null=False,
        help_text=_("Unique url-friendly slug"),
    )

    class HandleRef:
        tag = "facility"
        verbose_name = _("Facility")
        verbose_name_plural = _("Facilities")

    class ServiceBridge:

        # PDBCTL

        map_pdbctl = {
            "name": "name",
            "address1": "address1",
            "address2": "address2",
            "zipcode": "zipcode",
            "city": "city",
            "country": "country",
            "longitude": "longitude",
            "latitude": "latitude",
        }

        # NOTOBOT

        # TODO: support versioning ?
        # TODO: move outside of model definition ?

        map_nautobot = {
            "name": "name",
            "custom_fields.devicectl_id": "fullctl_id",
            "physical_address": "address1",
            "latitude": "latitude",
            "longitude": "longitude",
            "status": "nautobot_status",
        }

        lookup_nautobot = "cf_devicectl_id"

    class Meta:
        db_table = "devicectl_facility"
        constraints = [
            models.UniqueConstraint(
                fields=["instance", "slug"], name="unique_slug_instance_pair"
            )
        ]

    @property
    def org(self):
        return self.instance.org

    @property
    def nautobot_status(self):
        if self.status == "ok":
            return "active"

    def __str__(self):
        return f"{self.name} [#{self.id}]"


@reversion.register()
@grainy_model(
    namespace="device",
    namespace_instance="device.{instance.org.permission_id}.{instance.id}",
)
class Device(ServiceBridgeReferenceModel):
    instance = models.ForeignKey(
        Instance,
        related_name="devices",
        on_delete=models.CASCADE,
        help_text=_("deviceCtl environment instance"),
    )
    facility = models.ForeignKey(
        Facility,
        related_name="devices",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text=_("Device is located in this facility"),
    )

    name = models.CharField(max_length=255)
    description = DeviceDescriptionField()
    type = models.CharField(
        max_length=255,
        help_text=_("Type of device (software)"),
    )

    reference = ReferencedObjectCharField(
        bridge_type="device",
        max_length=255,
        null=True,
        blank=True,
        help_text=_("Remote reference id"),
    )

    class HandleRef:
        tag = "device"
        unique_together = (("instance", "name"),)

    class ServiceBridge:
        map_nautobot = {
            "display": "name",
            "comments": "description",
            "device_type.model": "type",
        }

    class Meta:
        db_table = "devicectl_device"
        verbose_name = _("Device")
        verbose_name_plural = _("Devices")
        indexes = [
            models.Index("reference", name="device_reference"),
        ]

    @property
    def display_name(self):
        return self.name

    @property
    def logical_ports(self):
        logical_port_ids = [p.logical_port_id for p in self.physical_ports.all()]
        return LogicalPort.objects.filter(id__in=logical_port_ids)

    @property
    def virtual_ports(self):
        return VirtualPort.objects.filter(logical_port__in=self.logical_ports)

    @property
    def ports(self):
        return None
        # TODO Port?
        # return Port.objects.filter(virtual_port__in=self.virtual_ports)

    @property
    def org(self):
        return self.instance.org

    @property
    @reversion.create_revision()
    def management_port(self):

        if hasattr(self, "_management_port_info"):
            return self._management_port_info

        port_info = PortInfo.objects.filter(
            instance=self.instance,
            is_management=True,
            port__virtual_port__logical_port__physical_ports__device_id=self.id,
        ).first()

        if port_info:
            self._management_port_info = port_info
            return port_info

        self.setup()

        virtual_port = VirtualPort.objects.filter(
            logical_port__physical_ports__device=self
        ).first()

        port_info = PortInfo.objects.create(
            instance=self.instance,
            ip_address_4=None,
            ip_address_6=None,
            is_management=True,
        )

        Port.objects.create(virtual_port=virtual_port, port_info=port_info)

        self._management_port_info = port_info

        return port_info

    def __str__(self):
        return f"Device({self.id}) {self.name}"

    def set_management_ip_address(self, ip):

        if not ip:
            return

        ip = ipaddress.ip_network(ip)

        management_port = self.management_port

        if ip.version == 4:
            if (
                management_port.ip_address_4
                and ipaddress.ip_network(management_port.ip_address_4) == ip
            ):
                return
            management_port.ip_address_4 = ip
        else:
            if (
                management_port.ip_address_6
                and ipaddress.ip_network(management_port.ip_address_6) == ip
            ):
                return
            management_port.ip_address_6 = ip

        management_port.save()

    def management_ip_address_4(self):
        return self.management_port.ip_address_4

    def managmeent_ip_address_6(self):
        return self.management_port.ip_address_6

    def setup(self):

        """
        minimal device setup - will create a rudimentary port set up for the device
        as needed
        """

        if not self.physical_ports.exists():
            logical_port = LogicalPort.objects.create(
                name="lp-001", instance=self.instance
            )
            PhysicalPort.objects.create(
                device=self, name="pp-001", logical_port=logical_port
            )

        for physical_port in self.physical_ports.all():
            physical_port.setup(self.instance)


@reversion.register()
@grainy_model(
    namespace="physical_port",
    namespace_instance="physical_port.{instance.org.permission_id}.{instance.id}",
)
class PhysicalPort(HandleRefModel):
    device = models.ForeignKey(
        Device,
        related_name="physical_ports",
        on_delete=models.CASCADE,
    )
    name = models.CharField(max_length=255)
    description = DeviceDescriptionField()

    logical_port = models.ForeignKey(
        "django_devicectl.LogicalPort",
        help_text=_("Logical port this physical port is a member of"),
        related_name="physical_ports",
        on_delete=models.CASCADE,
    )

    class HandleRef:
        tag = "physical_port"

    class Meta:
        db_table = "devicectl_physical_port"
        verbose_name = _("Physical Port")
        verbose_name_plural = _("Physical Ports")

    @property
    def org(self):
        return self.device.instance.org

    @property
    def display_name(self):
        return self.name

    @property
    def device_name(self):
        return self.device.name

    @property
    def logical_port_name(self):
        return self.logical_port.name

    def __str__(self):
        return f"PhyscalPort({self.id}) {self.name}"

    def setup(self, instance):

        """
        minimal setup - will create a rudimentary port set up
        as needed
        """

        self.logical_port.setup(instance)


@reversion.register()
@grainy_model(
    namespace="logical_port",
    namespace_instance="logical_port.{instance.org.permission_id}.{instance.id}",
)
class LogicalPort(HandleRefModel):
    """
    Logical port defines how to interact with multiple physical interfaces.

    For example:
        - an access port to a vlan ID on a physical port
        - trunk port
        - a LAG (ae port)
    """

    instance = models.ForeignKey(
        Instance, related_name="logical_ports", on_delete=models.CASCADE
    )
    name = models.CharField(max_length=255, blank=True)
    description = DeviceDescriptionField()
    trunk = models.IntegerField(blank=True, null=True)
    channel = models.IntegerField(blank=True, null=True)

    class HandleRef:
        tag = "logical_port"

    class Meta:
        db_table = "devctl_logical_port"
        verbose_name = _("Logical Port")
        verbose_name_plural = _("Logical Ports")

    @property
    def display_name(self):
        return self.name

    @property
    def org(self):
        return self.instance.org

    def __str__(self):
        return f"LogicalPort({self.id}) {self.name}"

    def setup(self, instance):

        """
        minimal setup - will create a rudimentary port set up
        as needed
        """

        if not self.virtual_ports.exists():
            VirtualPort.objects.create(
                logical_port=self,
                name="vp-001",
                vlan_id=0,
            )


@reversion.register()
@grainy_model(
    namespace="virtual_port",
    namespace_instance="virtual_port.{instance.org.permission_id}.{instance.id}",
)
class VirtualPort(HandleRefModel):
    """
    Port a peering session is build on, ties a virtual port back to a logical port
    """

    name = models.CharField(max_length=255, blank=True)

    logical_port = models.ForeignKey(
        LogicalPort,
        help_text="logical port",
        related_name="virtual_ports",
        on_delete=models.CASCADE,
    )

    vlan_id = models.IntegerField()

    class HandleRef:
        tag = "virtual_port"

    class Meta:
        db_table = "devicectl_virtual_port"
        verbose_name = _("Virtual Port")
        verbose_name_plural = _("Virtual Ports")

    @property
    def org(self):
        return self.logical_port.instance.org

    @property
    def display_name(self):
        return self.name

    @property
    def logical_port_name(self):
        return self.logical_port.name

    def __str__(self):
        return f"VirtualPort({self.id}) {self.name}"


@reversion.register()
@grainy_model(
    namespace="port_info",
    namespace_instance="port_info.{instance.org.permission_id}.{instance.id}",
)
class PortInfo(HandleRefModel):
    """ """

    instance = models.ForeignKey(
        Instance, related_name="port_infos", on_delete=models.CASCADE
    )

    ip_address_4 = InetAddressField(null=True, blank=True)
    ip_address_6 = InetAddressField(null=True, blank=True)

    is_management = models.BooleanField(default=False)
    is_routeserver_peer = models.BooleanField(default=False)

    speed = models.PositiveIntegerField(default=0)

    class HandleRef:
        tag = "port_info"

    class Meta:
        db_table = "devicectl_port_info"
        verbose_name = _("Port information")
        verbose_name_plural = _("Port information")
        unique_together = (("instance", "ip_address_4", "ip_address_6"),)

    @property
    def org(self):
        return self.instance.org

    @property
    def display_name(self):
        if self.ip_address_4:
            return f"{self.ip_address_4}"
        elif self.ip_address_6:
            return f"{self.ip_address_6}"
        return "-"

    def __str__(self):
        return f"PortInfo({self.id}) {self.display_name}"


@reversion.register()
@grainy_model(
    namespace="port",
    namespace_instance="port.{instance.org.permission_id}.{instance.id}",
)
class Port(HandleRefModel):
    """ """

    virtual_port = models.ForeignKey(
        VirtualPort, on_delete=models.CASCADE, related_name="ports"
    )

    port_info = models.OneToOneField(
        PortInfo, on_delete=models.CASCADE, related_name="port"
    )

    class HandleRef:
        tag = "port"

    class Meta:
        db_table = "devicectl_port"
        verbose_name = _("Port")
        verbose_name_plural = _("Ports")

    @property
    def org(self):
        return self.port_info.instance.org

    @property
    def display_name(self):
        return f"{self.virtual_port.display_name} port"

    def __str__(self):
        return f"Port({self.id}) {self.virtual_port.name}"
