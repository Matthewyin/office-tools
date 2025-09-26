#!/usr/bin/env python3
"""测试边标签的源目标区分功能"""

import tempfile
from pathlib import Path

from topotab.models import Endpoint, Link
from topotab.drawio_io import DrawioDocument


def test_edge_label_source_target_distinction():
    """测试边标签能够正确区分源和目标端点"""
    
    # 创建测试链路
    src_endpoint = Endpoint(
        device_name="Router-A",
        management_address="10.0.0.1",
        port_channel="1",
        physical_interface="Eth1/1",
        vrf="VRF-MAIN",
        vlan="100",
        interface_ip="192.168.1.1/30"
    )
    
    dst_endpoint = Endpoint(
        device_name="Router-B", 
        management_address="10.0.0.2",
        port_channel="2",
        physical_interface="Eth1/2",
        vrf="VRF-MAIN",
        vlan="100",
        interface_ip="192.168.1.2/30"
    )
    
    link = Link(
        sequence="1",
        src=src_endpoint,
        dst=dst_endpoint,
        usage="Test Link",
        cable_type="Fiber",
        bandwidth="10G"
    )
    
    # 创建draw.io文档
    document = DrawioDocument._create_blank()
    
    # 添加设备
    src_device_id = document.id_gen.new("device")
    dst_device_id = document.id_gen.new("device")
    
    # 添加链路
    edge_id = document.add_link(link, src_device_id, dst_device_id)
    
    # 验证生成的XML包含源目标标识
    with tempfile.NamedTemporaryFile(mode='w', suffix='.drawio', delete=False) as f:
        temp_path = Path(f.name)
        document.write(temp_path)
        
        # 读取生成的文件内容
        content = temp_path.read_text(encoding='utf-8')
        
        # 验证包含源端和目标端标识
        assert "源端:" in content, "应该包含源端标识"
        assert "目标端:" in content, "应该包含目标端标识"
        
        # 验证包含不同的背景色
        assert "#e1f5fe" in content, "应该包含源端标签背景色"
        assert "#fff3e0" in content, "应该包含目标端标签背景色"
        
        # 验证包含接口信息
        assert "Eth1/1" in content, "应该包含源端接口信息"
        assert "Eth1/2" in content, "应该包含目标端接口信息"
        
        # 清理临时文件
        temp_path.unlink()
    
    print("✅ 边标签源目标区分测试通过")


if __name__ == "__main__":
    test_edge_label_source_target_distinction()
