#!/usr/bin/env python3
"""演示简洁文本边标签功能"""

from pathlib import Path
from topotab.models import Endpoint, Link, Device, Region, Topology
from topotab.drawio_io import DrawioTopologyWriter


def create_demo_topology():
    """创建演示拓扑"""
    
    # 创建区域
    region = Region(name="数据中心", parent_name="")
    
    # 创建设备
    router_a = Device(
        device_name="Router-A",
        management_address="10.0.0.1",
        region="数据中心",
        parent_region="",
        device_model="ASR-9000",
        device_type="核心路由器",
        cabinet="CAB-A",
        u_position="10"
    )
    
    router_b = Device(
        device_name="Router-B",
        management_address="10.0.0.2",
        region="数据中心",
        parent_region="",
        device_model="ASR-9000",
        device_type="核心路由器",
        cabinet="CAB-B",
        u_position="10"
    )
    
    # 创建链路端点
    src_endpoint = Endpoint(
        device_name="Router-A",
        management_address="10.0.0.1",
        port_channel="1",
        physical_interface="GigE0/0/0/1",
        vrf="VRF-CORE",
        vlan="100",
        interface_ip="192.168.1.1/30"
    )
    
    dst_endpoint = Endpoint(
        device_name="Router-B",
        management_address="10.0.0.2",
        port_channel="1",
        physical_interface="GigE0/0/0/2",
        vrf="VRF-CORE",
        vlan="100",
        interface_ip="192.168.1.2/30"
    )
    
    # 创建链路
    link = Link(
        sequence="1",
        src=src_endpoint,
        dst=dst_endpoint,
        usage="核心互联",
        cable_type="光纤",
        bandwidth="10G",
        remark="主要链路"
    )
    
    # 创建拓扑
    topology = Topology(
        devices={
            "Router-A__10.0.0.1": router_a,
            "Router-B__10.0.0.2": router_b
        },
        links=[link],
        regions={"数据中心": region}
    )
    
    return topology


def main():
    """主函数"""
    print("创建演示拓扑...")
    topology = create_demo_topology()
    
    print("生成draw.io文件...")
    writer = DrawioTopologyWriter(topology)
    output_path = Path("output/demo_simple_text.drawio")
    writer.write(output_path)
    
    print(f"✅ 演示文件已生成: {output_path}")
    print()
    print("边标签显示效果：")
    print("源端文本框：")
    print("  PC1")
    print("  GigE0/0/0/1")
    print("  VRF:VRF-CORE")
    print("  VLAN:100")
    print("  192.168.1.1/30")
    print("\n目标端文本框：")
    print("  PC1")
    print("  GigE0/0/0/2")
    print("  VRF:VRF-CORE")
    print("  VLAN:100")
    print("  192.168.1.2/30")
    print()
    print("特点：")
    print("- 源端和目标端信息分别显示在两个独立的文本框中")
    print("- 源端文本框靠近源节点，目标端文本框靠近目标节点")
    print("- 每个字段分行显示，清晰易读")
    print("- 每个文本框都可以独立双击编辑")
    print("- 移动节点时标签完美跟随")


if __name__ == "__main__":
    main()
