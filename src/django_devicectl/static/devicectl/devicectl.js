(function($, $tc, $ctl) {

$ctl.application.Devicectl = $tc.extend(
  "Devicectl",
  {
    Devicectl : function() {
      this.Application("devicectl");

      this.urlkeys = {}
      this.facilities = {}
      this.facility_slugs = {}
      this.initial_load = false

      this.$c.header.app_slug = "device";

      this.$c.toolbar.widget("select_facility", ($e) => {
        var w = new twentyc.rest.Select($e.select_facility);
        $(w).on("load:after", (event, element, data) => {
          var i;
          for(i = 0; i < data.length; i++) {
            this.urlkeys[data[i].id] = data[i].urlkey;
            this.facilities[data[i].id] = data[i];
            this.facility_slugs[data[i].id] = data[i].slug;
          }

          if(data.length == 0) {
            $e.select_facility.attr('disabled', true);
            this.permission_ui();
          } else {
            $e.select_facility.attr('disabled', false)
            this.permission_ui();
          }
        });
        return w

      });

      $(this.$c.toolbar.$w.select_facility).one("load:after", () => {
        if(this.preselect_facility) {
          this.select_facility(this.preselect_facility)
        } else {
          this.sync();
          this.sync_url(this.$c.toolbar.$e.select_facility.val());
        }
      });

      $(this.$c.toolbar.$e.select_facility).on("change", () => {
        this.sync();
        this.sync_url(this.$c.toolbar.$e.select_facility.val())
      });

      this.tool("devices", () => {
        return new $ctl.application.Devicectl.Devices();
      });

      this.tool("logical_ports", () => {
        return new $ctl.application.Devicectl.LogicalPorts();
      });

      this.tool("physical_ports", () => {
        return new $ctl.application.Devicectl.PhysicalPorts();
      });

      this.tool("virtual_ports", () => {
        return new $ctl.application.Devicectl.VirtualPorts();
      });

      $(this.$c.toolbar.$e.button_create_facility).click(() => {
        fullctl.devicectl.page('settings');
        fullctl.devicectl.$t.settings.create_facility();
      });



      $($ctl).trigger("init_tools", [this]);

      this.$t.devices.activate();
      this.$t.logical_ports.activate();
      this.$t.physical_ports.activate();
      this.$t.virtual_ports.activate();

      this.sync();
    },


    facility : function() {
      return this.$c.toolbar.$w.select_facility.element.val();
    },

    facility_slug : function() {
      return this.facility_slugs[this.facility()];
    },

    facility_object: function() {
      return this.facilities[this.facility()]
    },

    urlkey : function() {
      return this.urlkeys[this.facility()];
    },

    unload_facility : function(id) {
      delete this.facilities[id];
      delete this.urlkeys[id];
      delete this.facility_slugs[id];
    },



    select_facility : function(id) {
      if(id)
        this.$c.toolbar.$e.select_facility.val(id);
      else {
        id = this.$c.toolbar.$e.select_facility.find('option').val();
        this.$c.toolbar.$e.select_facility.val(id);
      }

      this.sync();
      this.sync_url(id);
    },

    permission_ui : function() {
      let $e = this.$c.toolbar.$e;
      let facility = this.facilities[this.facility()];
      let org = $ctl.org.id;

      //$e.button_create_facility.grainy_toggle(`facility.${org}`, "c");
      //$e.button_import_facility.grainy_toggle(`facility.${org}`, "c");
    },


    sync_url: function(id) {
      var facility = this.facilities[id];
      var url = new URL(window.location)
      console.log("SUP", facility)
      if(!facility) {
        $('#no-facility-notify').show();
        url.pathname = `/${fullctl.org.slug}/`
      } else {
        url.pathname = `/${fullctl.org.slug}/${facility.slug}/`
        $('#no-facility-notify').hide();
      }
      window.history.pushState({}, '', url);
    },

    refresh : function() {
      return this.refresh_select_facility();
    },

    refresh_select_facility : function() {
      return this.$c.toolbar.$w.select_facility.refresh();
    }


  },
  $ctl.application.Application
);

$ctl.application.Devicectl.Devices = $tc.extend(
  "Devices",
  {
    Devices : function() {
      this.sot = false;
      this.Tool("devices");
    },
    init : function() {
      this.widget("list", ($e) => {
        return new twentyc.rest.List(
          this.template("list", this.$e.body)
        );
      })


      this.$w.list.format_request_url = (url) => {
        if(!$ctl.devicectl)
          return url;
        return url.replace(/facility_tag/, $ctl.devicectl.facility_slug());
      }

      this.$w.list.formatters.facility_name = (value, data) => {
        if(!value)
          return "-";
        return value;
      };

      this.$w.list.formatters.row = (row, data) => {

        if(data.reference_is_sot) {
          row.find('[data-sot=external]').show();
          row.find("[data-action=link_to_reference]").attr("href", data.reference_ux_url);
        } else {
          row.find('[data-sot=devicectl]').show();
        }


        row.find('a[data-action="edit_device"]').click(() => {
          var device = row.data("apiobject");
          new $ctl.application.Devicectl.ModalDevice(device);
        }).each(function() {
          if(!grainy.check(data.grainy+".?", "u")) {
            $(this).hide()
          }
        });

        if(!grainy.check(data.grainy, "d")) {
          row.find('a[data-api-method="DELETE"]').hide();
        }
      };

      this.initialize_sortable_headers("name");
    },

    menu : function() {
      var menu = this.Tool_menu();
      menu.find('[data-element="button_add_device"]').click(() => {
        if(this.sot) {
          return new $ctl.application.Devicectl.ModalDevice();
        } else {
          return new $ctl.application.Devicectl.ModalAssignDevice();
        }
      });

      return menu;
    },

    sync : function() {
      let namespace = `device.${$ctl.org.id}`
      if(grainy.check(namespace, "r")) {
        this.show();
        this.apply_ordering();
        this.$w.list.load();

        var facility_tag = ($ctl.devicectl ? $ctl.devicectl.facility_slug() : '')

        this.$e.menu.find('[data-element="button_api_view"]').attr(
          "href", this.$w.list.base_url.replace(/facility_tag/g,facility_tag) + "/" + this.$w.list.action +"?pretty"
        )

        this.$e.menu.find('[data-element="button_add_device"]').grainy_toggle(namespace, "c")

      } else {
        this.hide();
      }
    }
  },
  $ctl.application.Tool
);

$ctl.application.Devicectl.ModalAssignDevice = $tc.extend(
  "ModalDevice",
  {
    ModalDevice : function() {
      var modal = this;
      var title = "Add device to facility"
      var form = this.form = new twentyc.rest.Form(
        $ctl.template("form_assign_device")
      );

      this.select_device = new twentyc.rest.Select(this.form.element.find('#device'));

      this.select_device.load();

      $(this.form).on("api-write:success", (ev, e, payload, response) => {
        $ctl.devicectl.$t.devices.$w.list.load();
        modal.hide();
      });

      this.form.format_request_url = (url) => {
        return url.replace(/facility_tag/, $ctl.devicectl.facility_slug());
      };

      this.Modal("save", title, form.element);
      form.wire_submit(this.$e.button_submit);
    }
  },
  $ctl.application.Modal
);



$ctl.application.Devicectl.ModalDevice = $tc.extend(
  "ModalDevice",
  {
    ModalDevice : function(device) {
      var modal = this;
      var title = "Add Device"
      var form = this.form = new twentyc.rest.Form(
        $ctl.template("form_device")
      );

      $.ajax(
        {
          method: "options",
          url: form.base_url
        }
      ).done((data) => {

        var type_select = form.element.find('[name="type"]').empty();
        var options = data.data[0].actions.POST.type.choices;

        $(options).each(function() {
          type_select.append(
            $('<option>').val(this.value).text(this.display_name)
          )
        });

        if(device)
          type_select.val(device.type);


      });

      this.device = device;

      if(device) {
        title = "Edit "+device.display_name;
        form.method = "PUT"
        form.form_action = device.id;
        form.fill(device);


        form.element.find('input[type="text"],select,input[type="checkbox"]').each(function() {
          if(!grainy.check(device.grainy+"."+$(this).attr("name"), "u")) {
            $(this).attr("disabled", true)
          }
        });


        $(this.form).on("api-write:before", (ev, e, payload) => {
          payload["id"] = device.id;
        });
      }

      $(this.form).on("api-write:success", (ev, e, payload, response) => {
        $ctl.devicectl.$t.devices.$w.list.load();
        modal.hide();
      });

      this.Modal("save", title, form.element);
      form.wire_submit(this.$e.button_submit);
    }
  },
  $ctl.application.Modal
);



// LOGICAL PORTS

$ctl.application.Devicectl.LogicalPorts = $tc.extend(
  "LogicalPorts",
  {
    LogicalPorts : function() {
      this.Tool("logical_ports");
    },
    init : function() {
      this.widget("list", ($e) => {
        return new twentyc.rest.List(
          this.template("list", this.$e.body)
        );
      })
      this.$w.list.formatters.row = (row, data) => {
        row.find('a[data-action="edit_logical_port"]').click(() => {
          var logical_port = row.data("apiobject");
          new $ctl.application.Devicectl.ModalLogicalPort(logical_port);
        }).each(function() {
          if(!grainy.check(data.grainy+".?", "u")) {
            $(this).hide()
          }
        });

        if(!grainy.check(data.grainy, "d")) {
          row.find('a[data-api-method="DELETE"]').hide();
        }
      };

      this.initialize_sortable_headers("name");
    },

    menu : function() {
      var menu = this.Tool_menu();
      menu.find('[data-element="button_add_logical_port"]').click(() => {
        return new $ctl.application.Devicectl.ModalLogicalPort();
      });
      return menu;
    },

    sync : function() {
      let namespace = `logical_port.${$ctl.org.id}`
      if(grainy.check(namespace, "r")) {
        this.show();
        this.apply_ordering();
        this.$w.list.load();

        this.$e.menu.find('[data-element="button_api_view"]').attr(
          "href", this.$w.list.base_url + "/" + this.$w.list.action +"?pretty"
        )

        this.$e.menu.find('[data-element="button_add_logical_port"]').grainy_toggle(namespace, "c")

      } else {
        this.hide();
      }
    }
  },
  $ctl.application.Tool
);

$ctl.application.Devicectl.ModalLogicalPort = $tc.extend(
  "ModalLogicalPort",
  {
    ModalLogicalPort : function(logical_port) {
      var modal = this;
      var title = "Add LogicalPort"
      var form = this.form = new twentyc.rest.Form(
        $ctl.template("form_logical_port")
      );

      this.logical_port = logical_port;

      if(logical_port) {
        title = "Edit "+logical_port.display_name;
        form.method = "PUT"
        form.form_action = logical_port.id;
        form.fill(logical_port);


        form.element.find('input[type="text"],select,input[type="checkbox"]').each(function() {
          if(!grainy.check(logical_port.grainy+"."+$(this).attr("name"), "u")) {
            $(this).attr("disabled", true)
          }
        });


        $(this.form).on("api-write:before", (ev, e, payload) => {
          payload["id"] = logical_port.id;
        });
      }

      $(this.form).on("api-write:success", (ev, e, payload, response) => {
        $ctl.devicectl.$t.logical_ports.$w.list.load();
        modal.hide();
      });

      this.Modal("save", title, form.element);
      form.wire_submit(this.$e.button_submit);
    }
  },
  $ctl.application.Modal
);

// PHYSICAL PORTS

$ctl.application.Devicectl.PhysicalPorts = $tc.extend(
  "PhysicalPorts",
  {
    PhysicalPorts : function() {
      this.Tool("physical_ports");
    },
    init : function() {
      this.widget("list", ($e) => {
        return new twentyc.rest.List(
          this.template("list", this.$e.body)
        );
      })
      this.$w.list.formatters.row = (row, data) => {
        row.find('a[data-action="edit_physical_port"]').click(() => {
          var physical_port = row.data("apiobject");
          new $ctl.application.Devicectl.ModalPhysicalPort(physical_port);
        }).each(function() {
          if(!grainy.check(data.grainy+".?", "u")) {
            $(this).hide()
          }
        });

        if(!grainy.check(data.grainy, "d")) {
          row.find('a[data-api-method="DELETE"]').hide();
        }
      };

      this.initialize_sortable_headers("name");
    },

    menu : function() {
      var menu = this.Tool_menu();
      menu.find('[data-element="button_add_physical_port"]').click(() => {
        return new $ctl.application.Devicectl.ModalPhysicalPort();
      });
      return menu;
    },

    sync : function() {
      let namespace = `physical_port.${$ctl.org.id}`
      if(grainy.check(namespace, "r")) {
        this.show();
        this.apply_ordering();
        this.$w.list.load();

        this.$e.menu.find('[data-element="button_api_view"]').attr(
          "href", this.$w.list.base_url + "/" + this.$w.list.action +"?pretty"
        )

        this.$e.menu.find('[data-element="button_add_physical_port"]').grainy_toggle(namespace, "c")

      } else {
        this.hide();
      }
    }
  },
  $ctl.application.Tool
);

$ctl.application.Devicectl.ModalPhysicalPort = $tc.extend(
  "ModalPhysicalPort",
  {
    ModalPhysicalPort : function(physical_port) {
      var modal = this;
      var title = "Add PhysicalPort"
      var form = this.form = new twentyc.rest.Form(
        $ctl.template("form_physical_port")
      );

      var device_select = this.device_select = new twentyc.rest.Select(
        form.element.find('select[name="device"]')
      )

      device_select.format_request_url = (url) => {
        return url.replace(/facility_tag/, $ctl.devicectl.facility_slug());
      };

      device_select.load().then(() => {
        if(physical_port) { device_select.element.val(physical_port.device) }
      });

      var logical_port_select = this.logical_port_select = new twentyc.rest.Select(
        form.element.find('select[name="logical_port"]')
      )
      logical_port_select.load().then(() => {
        if(physical_port) { logical_port_select.element.val(physical_port.logical_port) }
      });
      this.physical_port = physical_port;

      if(physical_port) {
        title = "Edit "+physical_port.display_name;
        form.method = "PUT"
        form.form_action = physical_port.id;
        form.fill(physical_port);


        form.element.find('input[type="text"],select,input[type="checkbox"]').each(function() {
          if(!grainy.check(physical_port.grainy+"."+$(this).attr("name"), "u")) {
            $(this).attr("disabled", true)
          }
        });


        $(this.form).on("api-write:before", (ev, e, payload) => {
          payload["id"] = physical_port.id;
        });
      }

      $(this.form).on("api-write:success", (ev, e, payload, response) => {
        $ctl.devicectl.$t.physical_ports.$w.list.load();
        modal.hide();
      });

      this.Modal("save", title, form.element);
      form.wire_submit(this.$e.button_submit);
    }
  },
  $ctl.application.Modal
);


// VIRTUAL PORTS

$ctl.application.Devicectl.VirtualPorts = $tc.extend(
  "VirtualPorts",
  {
    VirtualPorts : function() {
      this.Tool("virtual_ports");
    },
    init : function() {
      this.widget("list", ($e) => {
        return new twentyc.rest.List(
          this.template("list", this.$e.body)
        );
      })
      this.$w.list.formatters.row = (row, data) => {
        row.find('a[data-action="edit_virtual_port"]').click(() => {
          var virtual_port = row.data("apiobject");
          new $ctl.application.Devicectl.ModalVirtualPort(virtual_port);
        }).each(function() {
          if(!grainy.check(data.grainy+".?", "u")) {
            $(this).hide()
          }
        });

        if(!grainy.check(data.grainy, "d")) {
          row.find('a[data-api-method="DELETE"]').hide();
        }
      };

      this.initialize_sortable_headers("name");
    },

    menu : function() {
      var menu = this.Tool_menu();
      menu.find('[data-element="button_add_virtual_port"]').click(() => {
        return new $ctl.application.Devicectl.ModalVirtualPort();
      });
      return menu;
    },

    sync : function() {
      let namespace = `virtual_port.${$ctl.org.id}`
      if(grainy.check(namespace, "r")) {
        this.show();
        this.apply_ordering();
        this.$w.list.load();

        this.$e.menu.find('[data-element="button_api_view"]').attr(
          "href", this.$w.list.base_url + "/" + this.$w.list.action +"?pretty"
        )

        this.$e.menu.find('[data-element="button_add_virtual_port"]').grainy_toggle(namespace, "c")

      } else {
        this.hide();
      }
    }
  },
  $ctl.application.Tool
);

$ctl.application.Devicectl.ModalVirtualPort = $tc.extend(
  "ModalVirtualPort",
  {
    ModalVirtualPort : function(virtual_port) {
      var modal = this;
      var title = "Add VirtualPort"
      var form = this.form = new twentyc.rest.Form(
        $ctl.template("form_virtual_port")
      );

      var logical_port_select = this.logical_port_select = new twentyc.rest.Select(
        form.element.find('select[name="logical_port"]')
      )
      logical_port_select.load().then(() => {
        if(virtual_port) { logical_port_select.element.val(virtual_port.logical_port) }
      });
      this.virtual_port = virtual_port;

      if(virtual_port) {
        title = "Edit "+virtual_port.display_name;
        form.method = "PUT"
        form.form_action = virtual_port.id;
        form.fill(virtual_port);


        form.element.find('input[type="text"],select,input[type="checkbox"]').each(function() {
          if(!grainy.check(virtual_port.grainy+"."+$(this).attr("name"), "u")) {
            $(this).attr("disabled", true)
          }
        });


        $(this.form).on("api-write:before", (ev, e, payload) => {
          payload["id"] = virtual_port.id;
        });
      }

      $(this.form).on("api-write:success", (ev, e, payload, response) => {
        $ctl.devicectl.$t.virtual_ports.$w.list.load();
        modal.hide();
      });

      this.Modal("save", title, form.element);
      form.wire_submit(this.$e.button_submit);
    }
  },
  $ctl.application.Modal
);



$(document).ready(function() {
  $ctl.devicectl = new $ctl.application.Devicectl();
});

})(jQuery, twentyc.cls, fullctl);
